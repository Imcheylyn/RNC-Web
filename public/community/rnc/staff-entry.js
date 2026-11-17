(() => {
  const REQUIRED_TAPS = 7
  const TAP_RESET_MS = 2500
  const NORMAL_NAVIGATION_DELAY_MS = 900
  let tapCount = 0
  let lastTapAt = 0
  let navigationTimer = 0
  let audioContext = null

  const playKnock = () => {
    try {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
      if (!AudioContextConstructor) return
      audioContext = audioContext || new AudioContextConstructor()
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {})

      const now = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const tone = audioContext.createGain()
      oscillator.type = "triangle"
      oscillator.frequency.setValueAtTime(155, now)
      oscillator.frequency.exponentialRampToValueAtTime(62, now + 0.085)
      tone.gain.setValueAtTime(0.0001, now)
      tone.gain.exponentialRampToValueAtTime(0.18, now + 0.009)
      tone.gain.exponentialRampToValueAtTime(0.0001, now + 0.13)
      oscillator.connect(tone)
      tone.connect(audioContext.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.14)

      const sampleCount = Math.floor(audioContext.sampleRate * 0.075)
      const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate)
      const data = buffer.getChannelData(0)
      for (let index = 0; index < sampleCount; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount)
      }
      const noise = audioContext.createBufferSource()
      const filter = audioContext.createBiquadFilter()
      const noiseGain = audioContext.createGain()
      noise.buffer = buffer
      filter.type = "lowpass"
      filter.frequency.value = 720
      noiseGain.gain.setValueAtTime(0.0001, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.08, now + 0.006)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)
      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(audioContext.destination)
      noise.start(now)
      noise.stop(now + 0.08)
    } catch {
      // Some browsers disable audio until the user interacts with the page.
    }
  }

  const dialog = document.createElement("dialog")
  dialog.className = "staff-entry-dialog"
  dialog.setAttribute("aria-labelledby", "staffEntryTitle")
  dialog.innerHTML =
    '<form class="staff-entry-form">' +
      '<p class="staff-entry-kicker">RNC / STAFF ACCESS</p>' +
      '<h2 id="staffEntryTitle">เข้าสู่โหมด Staff</h2>' +
      '<p class="staff-entry-description">กรอกรหัสผ่านเพื่อยืนยันสิทธิ์เจ้าหน้าที่ Discord</p>' +
      '<label for="staffEntryPasscode">รหัสผ่าน</label>' +
      '<input id="staffEntryPasscode" name="passcode" type="password" autocomplete="current-password" required maxlength="256">' +
      '<p class="staff-entry-error" role="alert" aria-live="polite" hidden></p>' +
      '<div class="staff-entry-actions">' +
        '<button type="button" class="staff-entry-cancel">ยกเลิก</button>' +
        '<button type="submit" class="staff-entry-submit">ยืนยัน</button>' +
      '</div>' +
    '</form>'
  document.body.append(dialog)

  const form = dialog.querySelector(".staff-entry-form")
  const input = dialog.querySelector("#staffEntryPasscode")
  const message = dialog.querySelector(".staff-entry-error")
  const submit = dialog.querySelector(".staff-entry-submit")

  dialog.querySelector(".staff-entry-cancel").addEventListener("click", () => dialog.close())
  dialog.addEventListener("close", () => {
    form.reset()
    message.hidden = true
    message.textContent = ""
  })

  form.addEventListener("submit", async event => {
    event.preventDefault()
    submit.disabled = true
    submit.textContent = "กำลังตรวจสอบ…"
    message.hidden = true

    try {
      const response = await fetch("/api/community/staff/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ passcode: input.value }),
      })
      if (response.ok) {
        window.location.assign("/community/staff")
        return
      }
      const error = await response.json().catch(() => ({}))
      if (error.error === "unauthorized") {
        window.location.assign("/community")
        return
      }
      message.textContent = response.status === 503
        ? "โหมด Staff ยังตั้งค่าไม่ครบ"
        : response.status === 429
          ? "ลองใหม่อีกครั้งในอีกสักครู่"
          : response.status === 403
            ? "บัญชี Discord นี้ยังไม่มี Staff role ที่ระบบกำหนด"
            : response.status === 401
              ? "รหัสผ่าน Staff ไม่ถูกต้อง"
              : "ตรวจสอบสิทธิ์ Staff ไม่สำเร็จ ลองใหม่อีกครั้งนะ"
      message.hidden = false
      if (response.status === 401) input.select()
    } catch {
      message.textContent = "เชื่อมต่อระบบตรวจสอบไม่ได้ ลองอีกครั้งนะ"
      message.hidden = false
    } finally {
      submit.disabled = false
      submit.textContent = "ยืนยัน"
    }
  })

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null
    const brand = target && target.closest(".community-brand, .brand")
    if (!brand || event.detail === 0 || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    event.preventDefault()
    const now = Date.now()
    tapCount = now - lastTapAt > TAP_RESET_MS ? 1 : tapCount + 1
    lastTapAt = now
    playKnock()

    if (navigationTimer) window.clearTimeout(navigationTimer)
    if (tapCount >= REQUIRED_TAPS) {
      tapCount = 0
      lastTapAt = 0
      if (!dialog.open) dialog.showModal()
      window.setTimeout(() => input.focus(), 0)
      return
    }

    const destination = brand.getAttribute("href")
    if (!destination) return
    navigationTimer = window.setTimeout(() => {
      window.location.assign(destination)
    }, NORMAL_NAVIGATION_DELAY_MS)
  }, true)
})()