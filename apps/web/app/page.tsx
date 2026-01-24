"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Home() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setStatus(res.data.health))
      .catch(() => setStatus("backend unreachable"));
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h1>Tune-In 🚀</h1>
      <p>
        Backend status: <b>{status}</b>
      </p>
    </main>
  );
}
