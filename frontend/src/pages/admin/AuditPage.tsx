import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AuditEntry, Staff } from "../../lib/types";
import { AuditTable } from "./QueuePage";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  useEffect(() => {
    api.audit(200).then(setRows).catch(() => {});
    api.staff().then(setStaff).catch(() => {});
  }, []);
  return (
    <>
      <div className="adm-top"><h3>Audit log<span>every approve / reject / field publish, attributed &amp; timestamped</span></h3></div>
      <div className="adm-scroll"><AuditTable rows={rows} staff={staff} /></div>
    </>
  );
}
