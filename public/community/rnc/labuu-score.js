(function () {
  "use strict";

  const ENDPOINT = "/api/community/arcade/labuu";
  const PRACTICE_DURATION = 60_000;
  const MAX_MISSES = 90;
  const format = value => value == null ? "—" : String(value).padStart(5, "0");

  async function request(body) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: body.action === "finish",
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) {
      const error = new Error("บันทึกคะแนนไม่ได้");
      error.retryable = response.status >= 500 || response.status === 429;
      throw error;
    }
    return response.json();
  }

  async function start() {
    const round = { durationMs: PRACTICE_DURATION, clicks: [], found: 0, misses: 0 };
    try {
      const data = await request({ action: "start" });
      return { ...round, ...data };
    } catch {
      return round;
    }
  }

  function record(round, index) {
    if (index < 7) round.found++;
    else {
      if (round.misses >= MAX_MISSES) return;
      round.misses++;
    }
    if (round.roundId) round.clicks.push(round.targets[index]);
  }

  function points(round, remainingMs = 0) {
    return Math.max(0, round.found * 1000 + Math.floor(remainingMs / 1000) * 25 - round.misses * 100);
  }

  function submit(round) {
    return request({ action: "finish", roundId: round.roundId, clicks: round.clicks })
      .then(data => ({ data }))
      .catch(error => ({ retryable: error.retryable !== false }));
  }

  function finish(round, remainingMs) {
    round.score = points(round, remainingMs);
    if (round.roundId) round.pending = submit(round);
  }

  function show(container, round) {
    const score = container.querySelector("[data-round-score]");
    const best = container.querySelector("[data-round-best]");
    const status = container.querySelector("[data-round-status]");
    const retry = container.querySelector("[data-round-retry]");
    score.textContent = format(round.score);

    async function display(pending) {
      retry.hidden = true;
      status.textContent = "กำลังบันทึกคะแนน";
      const { data, retryable } = await pending;
      if (data) {
        score.textContent = format(data.score);
        best.textContent = format(data.bestScore);
        status.textContent = "บันทึกคะแนนกับบัญชี Discord แล้ว";
      } else {
        status.textContent = "รอบนี้ยังไม่ถูกบันทึกในอันดับของเซิร์ฟ";
        retry.hidden = !retryable;
      }
    }

    if (round.pending) {
      void display(round.pending);
      retry.addEventListener("click", () => { void display(submit(round)); });
    } else {
      status.textContent = "รอบฝึกซ้อม · คะแนนไม่เข้าอันดับของเซิร์ฟ";
    }
  }

  window.RNCLabuuScore = { start, record, points, finish, show };
})();
