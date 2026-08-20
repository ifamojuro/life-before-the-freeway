import io


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_pins_and_era_filter(client):
    pins = client.get("/api/locations").json()
    assert len(pins) >= 8
    assert all(p["story_count"] >= 1 for p in pins)
    p1985 = client.get("/api/locations", params={"era": "1985"}).json()
    assert 0 < len(p1985) < len(pins)


def test_location_detail_and_comment(client):
    pins = client.get("/api/locations").json()
    slim = next(p for p in pins if p["name"].startswith("Slim"))
    d = client.get(f"/api/locations/{slim['id']}").json()
    assert len(d["stories"]) == 2  # two perspectives
    assert d["era_range"] == "~1950–1965"
    n = len(d["comments"])
    r = client.post(f"/api/locations/{slim['id']}/comments", json={"author": "Test", "text": "Hello"})
    assert r.status_code == 201
    assert len(client.get(f"/api/locations/{slim['id']}").json()["comments"]) == n + 1


def test_prompts(client):
    r = client.get("/api/prompts/random").json()
    assert "text" in r
    r2 = client.get("/api/prompts/random", params={"exclude": r["id"]}).json()
    assert r2["id"] != r["id"]


def test_chat_is_scoped_with_citations(client):
    r = client.post("/api/chat", json={"question": "What was on 7th Street?"}).json()
    assert r["mode"] == "extractive"
    assert r["citations"], r
    assert any("bank" in c["location_name"].lower() or "Slim" in c["location_name"] for c in r["citations"])
    r2 = client.post("/api/chat", json={"question": "zebra quantum spreadsheet"}).json()
    assert r2["citations"] == []
    assert "don't cover" in r2["answer"]


def test_contributor_flow_then_moderation(client, admin):
    # 1. upload a clip -> transcript, flags, detected places
    files = {"file": ("7th-street-memory.webm", io.BytesIO(b"\x1aE\xdf\xa3fake-webm"), "video/webm")}
    r = client.post("/api/submissions/upload", files=files, data={"method": "recorded", "duration_s": "31"})
    assert r.status_code == 201, r.text
    up = r.json()
    assert up["transcript"]
    assert up["detected_places"], up
    # 2. submit
    body = {
        "upload_id": up["upload_id"], "contributor_name": "Denise Watkins", "contributor_email": "d@example.com",
        "places": [{"name": p["name"], "source": "transcript", "lat": p["lat"] or 37.805, "lng": p["lng"] or -122.29,
                    "location_id": p["location_id"]} for p in up["detected_places"][:2]],
        "eras": ["1950", "1965"], "agreed_norms": True,
    }
    r = client.post("/api/submissions", json=body)
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    assert r.json()["status"] == "pending"

    # 3. appears in the queue; unauthenticated access is rejected
    assert client.get("/api/admin/submissions").status_code == 401
    q = client.get("/api/admin/submissions", headers=admin, params={"status": "pending"}).json()
    assert any(i["id"] == sid for i in q["items"])
    assert q["counts"]["pending"] >= 1

    # 4. detail + save location associations
    d = client.get(f"/api/admin/submissions/{sid}", headers=admin).json()
    assert d["transcript"]
    assoc = [{"id": "x1", "start_s": 0, "end_s": 12, "location_id": d["places"][0]["location_id"], "name": d["places"][0]["name"],
              "lat": d["places"][0]["lat"], "lng": d["places"][0]["lng"], "era": "1950", "color": "#0F7B6C"},
             {"id": "x2", "start_s": 14, "end_s": 28, "location_id": None, "name": "New corner", "sub": "9th & Pine",
              "lat": 37.806, "lng": -122.295, "era": "1965", "color": "#185FA5"}]
    r = client.put(f"/api/admin/submissions/{sid}/associations", headers=admin, json={"associations": assoc})
    assert r.status_code == 200, r.text
    assert len(r.json()["associations"]) == 2

    # 5. approve -> stories published per association, audit logged
    before = len(client.get("/api/locations").json())
    r = client.post(f"/api/admin/submissions/{sid}/approve", headers=admin, json={})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"
    after = client.get("/api/locations").json()
    assert len(after) == before + 1  # "New corner" is a brand-new pin
    newpin = next(p for p in after if p["name"] == "New corner")
    det = client.get(f"/api/locations/{newpin['id']}").json()
    assert det["stories"][0]["start_s"] == 14 and det["stories"][0]["end_s"] == 28
    audit = client.get("/api/admin/audit", headers=admin).json()
    assert audit[0]["action"] == "approved" and audit[0]["reviewer_name"] == "Randolph A."
    # can't approve twice
    assert client.post(f"/api/admin/submissions/{sid}/approve", headers=admin, json={}).status_code == 409


def test_reject(client, admin):
    q = client.get("/api/admin/submissions", headers=admin, params={"status": "flagged"}).json()
    assert q["items"] and all(i["flag_count"] > 0 for i in q["items"])
    sid = q["items"][0]["id"]
    r = client.post(f"/api/admin/submissions/{sid}/reject", headers=admin, json={"reason": "Off topic"})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    audit = client.get("/api/admin/audit", headers=admin).json()
    assert audit[0]["action"] == "rejected" and audit[0]["detail"] == "Off topic"


def test_field_capture_publishes_directly(client, admin):
    files = {"file": ("ellis.mov", io.BytesIO(b"fake"), "video/quicktime")}
    up = client.post("/api/submissions/upload", files=files, data={"method": "uploaded"}).json()
    body = {"upload_id": up["upload_id"], "contributor_name": "Mr. Ellis", "contributor_detail": "b. 1944",
            "eras": ["1965"], "places": [{"name": "Wood & 5th", "lat": 37.8025, "lng": -122.2977}]}
    r = client.post("/api/admin/field-capture", headers=admin, json=body)
    assert r.status_code == 201, r.text
    pub = client.get("/api/admin/stories", headers=admin).json()
    assert pub[0]["source"] == "field" and pub[0]["contributor_name"] == "Mr. Ellis"
    audit = client.get("/api/admin/audit", headers=admin).json()
    assert audit[0]["action"] == "published_field"


def test_staff_and_me(client, admin):
    assert client.get("/api/admin/me", headers=admin).json()["role"] == "super-admin"
    assert len(client.get("/api/admin/staff", headers=admin).json()) == 3
