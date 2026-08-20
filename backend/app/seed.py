"""Seed the database with the wireframe's sample archive so the app is
explorable immediately. Safe to run repeatedly (no-op once seeded)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import AuditEntry, Comment, Location, Prompt, Staff, Story, Submission

ERA_LABEL = {"1950": "~1950 · before", "1965": "1965 · the takings", "1985": "1985 · after"}


def seed(db: Session) -> None:
    if db.execute(select(Location.id).limit(1)).first():
        return

    now = datetime.now(timezone.utc)

    locations = {
        "slim": Location(name="Slim Jenkins' Supper Club", cross_street="7th & Wood St", lat=37.80707, lng=-122.30236,
                         eras=["1950", "1965"], aliases=["Slim Jenkins", "Slim Jenkins'", "the supper club"]),
        "bank": Location(name="The bank block", cross_street="7th & Chestnut", lat=37.80390, lng=-122.28870,
                         eras=["1950", "1965"], aliases=["the three banks", "bank block", "7th and Chestnut"]),
        "defrem": Location(name="DeFremery Park", cross_street="18th & Adeline", lat=37.81120, lng=-122.28820,
                           eras=["1950", "1965", "1985"], aliases=["DeFremery", "the park"]),
        "chest8": Location(name="Chestnut & 8th", cross_street="Chestnut & 8th St", lat=37.80480, lng=-122.28840,
                           eras=["1950", "1965"], aliases=["Chestnut and 8th"]),
        "union": Location(name="Union & 10th", cross_street="Union & 10th St", lat=37.80713, lng=-122.28940,
                          eras=["1950", "1965", "1985"], aliases=["Union Street", "Union St"]),
        "wood5": Location(name="Wood & 5th", cross_street="Wood & 5th St", lat=37.80530, lng=-122.30290,
                          eras=["1950", "1965"], aliases=["Wood and 5th"]),
        "peralta": Location(name="Peralta & 12th", cross_street="Peralta & 12th St", lat=37.81014, lng=-122.29506,
                            eras=["1950", "1985"], aliases=["Peralta"]),
        "church": Location(name="Taylor Memorial church", cross_street="12th & Myrtle", lat=37.80770, lng=-122.28450,
                           eras=["1950", "1965", "1985"], aliases=["the church", "Taylor Memorial"]),
        "record": Location(name="The record store", cross_street="7th & Center St", lat=37.80534, lng=-122.29494,
                           eras=["1950"], aliases=["record store", "Center St"]),
    }
    db.add_all(locations.values())
    db.flush()

    def story(loc, name, detail, initials, color, caption, transcript, era, dur, src="backfill", days=30):
        s = Story(location_id=locations[loc].id, contributor_name=name, contributor_detail=detail, initials=initials,
                  avatar_color=color, caption=caption, transcript=transcript, era=era, era_label=ERA_LABEL[era],
                  duration_s=dur, source=src, published_at=now - timedelta(days=days), video_url=None)
        db.add(s)
        return s

    story("slim", "Ms. Carter", "Lived on Wood St, b. 1931", "MC", "#1D9E75",
          "Friday nights the whole block lit up — you could hear the horns from our porch two doors down.",
          "We lived on Wood Street two doors down from 7th. Friday nights the whole block lit up — you could hear the horns "
          "from Slim Jenkins' supper club from our porch. Touring musicians played there; people dressed up for it.", "1950", 34, days=40)
    story("slim", "Mr. Ellis", "Delivered here as a teen, b. 1944", "RE", "#185FA5",
          "Folks call it a supper club, but by my time it was more a pool hall. Depends who you ask.",
          "Folks call Slim Jenkins' a supper club, but by my time, delivering groceries on 7th Street, it was more a pool hall. "
          "It changed hands a few times before they tore it down for the freeway. Depends who you ask.", "1965", 28, days=12)
    story("bank", "Mr. Ellis", "Delivered here as a teen, b. 1944", "RE", "#185FA5",
          "Three banks in a row — that was the money corner. My daddy called it the busiest corner in Oakland.",
          "7th and Chestnut was the bank block. Three banks in a row, right there — the money corner. 7th Street was the "
          "commercial heart: banks, record stores, clubs. Much of it was cleared for the I-980 corridor.", "1965", 31, days=20)
    story("bank", "Mrs. Okafor", "Grew up on Chestnut, b. 1939", "JO", "#7A5AA8",
          "We'd cash my father's check at the corner bank and get a soda next door. That whole block is air now.",
          "We'd cash my father's check at the corner bank on 7th and Chestnut and get a soda next door. The three banks, "
          "the barber, the record store — that whole block is air now, just the freeway.", "1950", 26, days=18)
    story("defrem", "Ms. Carter", "Lived on Wood St, b. 1931", "MC", "#1D9E75",
          "After the takings we went up to DeFremery Park on Sundays. It was the one place that stayed.",
          "After the takings in '65 we'd go up to DeFremery Park on Sundays. The Panthers fed kids breakfast there later. "
          "It was the one place in the neighborhood that stayed the same after the freeway came through.", "1985", 30, days=25)
    story("chest8", "Deacon Hill", "Church on 8th since 1952", "DH", "#8A6D3B",
          "There was a bakery near Chestnut and 8th — you'd smell it walking to church.",
          "There was a bakery near Chestnut and 8th. You'd smell the bread walking to church on Sunday morning. "
          "The bakery went in the first round of property takings, 1964 or '65.", "1950", 22, days=33)
    story("union", "Mrs. Okafor", "Grew up on Chestnut, b. 1939", "JO", "#7A5AA8",
          "On Union Street everybody knew you. The neighbors looked out for each other — that was the best thing.",
          "The best thing about being Black in West Oakland was that everybody knew you. On Union Street the neighbors "
          "looked out for each other. Union and 10th was where my aunt stayed; we were always on somebody's porch.", "1950", 29, days=15)
    story("wood5", "Mr. Ellis", "Delivered here as a teen, b. 1944", "RE", "#185FA5",
          "Wood and 5th was where my cousins stayed until the takings. Then everybody scattered.",
          "Wood and 5th was where my cousins stayed until the takings. They got a letter, then an offer, then a deadline. "
          "Then everybody scattered — some to East Oakland, some out of state.", "1965", 30, days=22)
    story("peralta", "Deacon Hill", "Church on 8th since 1952", "DH", "#8A6D3B",
          "The choir on Peralta you could hear a block away. After the freeway you could hear the cars instead.",
          "The church choir on Peralta you could hear a block away. After the freeway opened in '85 you could hear the cars "
          "instead. Peralta and 12th is still there, but it's cut off from 7th now.", "1985", 27, days=9)
    story("church", "Deacon Hill", "Church on 8th since 1952", "DH", "#8A6D3B",
          "Taylor Memorial held the neighborhood meetings about the freeway. People came angry and left organized.",
          "Taylor Memorial church held the neighborhood meetings about the freeway plans. People came in angry and left "
          "organized. The churches were the backbone — there were three of them within four blocks.", "1965", 33, days=11)
    story("record", "Mrs. Okafor", "Grew up on Chestnut, b. 1939", "JO", "#7A5AA8",
          "The record store on 7th played music out the door. You could hear what was new before it hit the radio.",
          "The record store on 7th near Center Street played music out the door all day. You'd hear what was new before it "
          "hit the radio. Touring musicians would stop in after playing the clubs.", "1950", 24, days=28)

    db.add_all([
        Comment(location_id=locations["slim"].id, author="Denise W.", created_at=now - timedelta(days=3),
                text="My grandmother tended bar here. Seeing this block again after all these years — thank you for keeping it alive."),
        Comment(location_id=locations["slim"].id, author="Anthony J.", created_at=now - timedelta(days=5),
                text="Both stories are true honestly. It changed hands a few times before they tore it down."),
        Comment(location_id=locations["slim"].id, author="Loretta M.", created_at=now - timedelta(days=8),
                text="My uncle played trumpet there in '58. He said the stage was no bigger than a kitchen table."),
        Comment(location_id=locations["slim"].id, author="Kev B.", created_at=now - timedelta(days=12),
                text="Grew up hearing about this place. Never knew exactly where it was until this map."),
        Comment(location_id=locations["bank"].id, author="Paula R.", created_at=now - timedelta(days=6),
                text="My mother opened her first account on this corner. She kept the passbook her whole life."),
    ])

    db.add_all([
        Prompt(text="What's the best thing about being Black in West Oakland?"),
        Prompt(text="Tell me about a business on 7th Street you still think about."),
        Prompt(text="What did the neighborhood sound like before the freeway?"),
        Prompt(text="Where did your family go on Sundays?"),
        Prompt(text="What do you remember about the day the houses started coming down?"),
        Prompt(text="Who was a neighbor everybody knew?"),
        Prompt(text="What's a corner that means something to you, and why?"),
    ])

    staff = [
        Staff(name="Randolph A.", email="randolph@lbtf.org", role="super-admin", password_hash=hash_password("admin"), color="#0F7B6C"),
        Staff(name="Maya T.", email="maya@lbtf.org", role="intern", password_hash=hash_password("admin"), color="#0F7B6C"),
        Staff(name="Jordan P.", email="jordan@lbtf.org", role="intern", password_hash=hash_password("admin"), color="#98A2AA"),
    ]
    db.add_all(staff)
    db.flush()

    # Pending queue (mirrors the wireframe), plus a few decided items for the audit log.
    def sub(label, name, days, dur, flagged, transcript, eras, places, status="pending", method="recorded"):
        s = Submission(
            contributor_name=name, contributor_email=f"{name.split()[0].lower()}@example.com", source="public", method=method,
            prompt_text="What's the best thing about being Black in West Oakland?", video_url=None, duration_s=dur,
            transcript=transcript, flagged_terms=flagged, eras=eras, places=places, primary_label=label, status=status,
            agreed_norms=True, created_at=now - timedelta(days=days),
            segments=[{"start": 0, "end": dur, "text": transcript}],
        )
        db.add(s)
        return s

    s1 = sub("7th & Wood St", "Denise W.", 1, 37, [{"term": "damn", "at_s": 31.0, "context": "busiest damn corner in Oakland"}],
             "…we'd walk down 7th, past Slim Jenkins', all the way to where the three banks were. My daddy called it the busiest damn corner in Oakland…",
             ["1950", "1965"], [
                 {"name": "7th & Wood St", "source": "transcript", "lat": 37.80707, "lng": -122.30236, "location_id": locations["slim"].id},
                 {"name": "The bank block", "source": "transcript", "lat": 37.80390, "lng": -122.28870, "location_id": locations["bank"].id},
                 {"name": "Chestnut", "source": "manual", "lat": 37.80480, "lng": -122.28840, "location_id": None},
             ])
    s1.segments = [
        {"start": 0, "end": 13, "text": "…we'd walk down 7th, past Slim Jenkins',"},
        {"start": 13, "end": 24, "text": "all the way to where the three banks were."},
        {"start": 24, "end": 37, "text": "My daddy called it the busiest damn corner in Oakland…"},
    ]
    s1.associations = [
        {"id": "a1", "start_s": 2, "end_s": 13, "location_id": locations["slim"].id, "name": "7th & Wood St", "sub": "existing pin", "lat": 37.80707, "lng": -122.30236, "era": "1950", "color": "#0F7B6C"},
        {"id": "a2", "start_s": 15, "end_s": 24, "location_id": locations["bank"].id, "name": "The bank block", "sub": "7th & Chestnut", "lat": 37.80390, "lng": -122.28870, "era": "1965", "color": "#185FA5"},
        {"id": "a3", "start_s": 26, "end_s": 35, "location_id": None, "name": "", "sub": "", "lat": None, "lng": None, "era": "1985", "color": "#7A5AA8"},
    ]
    sub("Chestnut & 8th", "Harold B.", 1, 33, [], "The bakery on Chestnut and 8th — you could smell it from church.", ["1950"],
        [{"name": "Chestnut & 8th", "source": "transcript", "lat": 37.80480, "lng": -122.28840, "location_id": locations["chest8"].id}])
    sub("Center St (untagged area)", "Ruth S.", 2, 41, [], "There was a little market on Center Street my mother sent me to every morning.", ["1950", "1965"],
        [{"name": "Center St", "source": "transcript", "lat": None, "lng": None, "location_id": None}], method="uploaded")
    sub("Union & 10th", "Marcus L.", 2, 22, [{"term": "hell", "at_s": 8.0, "context": "hell of a block party"}, {"term": "damn", "at_s": 17.0, "context": "damn shame what they did"}],
        "Union and 10th threw a hell of a block party every summer. Damn shame what they did to it.", ["1950", "1965"],
        [{"name": "Union & 10th", "source": "transcript", "lat": 37.80713, "lng": -122.28940, "location_id": locations["union"].id}])
    sub("Wood & 5th", "Gloria P.", 3, 30, [], "My cousins stayed at Wood and 5th until the letters came.", ["1965"],
        [{"name": "Wood & 5th", "source": "transcript", "lat": 37.80530, "lng": -122.30290, "location_id": locations["wood5"].id}])
    sub("Peralta & 12th", "Teddy R.", 3, 27, [], "Peralta and 12th still has the same corner store, different owners.", ["1985"],
        [{"name": "Peralta & 12th", "source": "transcript", "lat": 37.81014, "lng": -122.29506, "location_id": locations["peralta"].id}], method="uploaded")
    sub("Adeline & 14th", "Carmen V.", 4, 35, [], "The streetcar ran up Adeline; we rode it downtown for a nickel.", ["1950"],
        [{"name": "Adeline & 14th", "source": "transcript", "lat": 37.81030, "lng": -122.29130, "location_id": None}])

    d1 = sub("7th & Chestnut — “the bank block”", "Paula R.", 6, 29, [], "Three banks in a row.", ["1950"], [], status="approved")
    d1.reviewed_at = now - timedelta(days=1, hours=2); d1.reviewed_by_id = staff[0].id
    d2 = sub("Union & 9th — porch memory", "Anon", 7, 25, [], "…", ["1965"], [], status="rejected")
    d2.reviewed_at = now - timedelta(days=1, hours=5); d2.reviewed_by_id = staff[1].id; d2.reject_reason = "Not about West Oakland"
    d3 = sub("Wood St — supper club (Ms. Carter)", "Ms. Carter", 9, 34, [], "…", ["1950"], [], status="approved")
    d3.reviewed_at = now - timedelta(days=2, hours=3); d3.reviewed_by_id = staff[1].id
    db.flush()

    db.add_all([
        AuditEntry(submission_id=d1.id, submission_label=d1.primary_label, action="approved", reviewer_id=staff[0].id, reviewer_name=staff[0].name, at=d1.reviewed_at),
        AuditEntry(submission_id=d2.id, submission_label=d2.primary_label, action="rejected", reviewer_id=staff[1].id, reviewer_name=staff[1].name, at=d2.reviewed_at, detail=d2.reject_reason),
        AuditEntry(submission_id=d3.id, submission_label=d3.primary_label, action="approved", reviewer_id=staff[1].id, reviewer_name=staff[1].name, at=d3.reviewed_at),
        AuditEntry(submission_id=None, submission_label="Field capture — Mr. Ellis interview", action="published_field", reviewer_id=staff[0].id, reviewer_name=staff[0].name, at=now - timedelta(days=2, hours=8)),
    ])
    db.commit()
