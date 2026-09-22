// LevelUp Home Screen widget — paste this whole file into a new script in
// the Scriptable app (see the setup instructions LevelUp gave you).
// Small widget: your streak + water. Medium widget: adds your partner's streak.

const FUNCTIONS_BASE = "https://yysoevmtllpbbhhhwrmf.supabase.co/functions/v1"
const YOU_COLOR = "#14B8C4"
const HER_COLOR = "#FB6F92"
const INK_COLOR = "#23222B"
const INK_SOFT = "#77757F"
const PAPER = "#FCFBFC"

async function getToken() {
  const key = "levelup_api_token"
  if (Keychain.contains(key)) return Keychain.get(key)

  const alert = new Alert()
  alert.title = "LevelUp token"
  alert.message = "Paste your API token — find it in the app under Settings → Widgets & Shortcuts."
  alert.addTextField("token")
  alert.addAction("Save")
  await alert.presentAlert()
  const token = alert.textFieldValue(0)
  Keychain.set(key, token)
  return token
}

async function fetchData(token) {
  const req = new Request(`${FUNCTIONS_BASE}/widget-data`)
  req.headers = { "x-api-token": token }
  return await req.loadJSON()
}

function addLine(stack, text, { color = INK_COLOR, size = 14, bold = false } = {}) {
  const t = stack.addText(text)
  t.textColor = new Color(color)
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size)
}

function createWidget(data) {
  const w = new ListWidget()
  w.backgroundColor = new Color(PAPER)
  w.setPadding(14, 14, 14, 14)

  const you = w.addStack()
  you.layoutVertically()
  addLine(you, data.display_name || "You", { color: INK_SOFT, size: 12 })
  addLine(you, `🔥 ${data.current_streak ?? 0}`, { color: YOU_COLOR, size: 26, bold: true })

  w.addSpacer(6)

  const pct = data.water_target_ml ? Math.min(Math.round((data.water_ml / data.water_target_ml) * 100), 100) : 0
  addLine(w, `💧 ${data.water_ml ?? 0} / ${data.water_target_ml ?? 0} ml (${pct}%)`, { color: INK_COLOR, size: 13 })

  if (data.partner) {
    w.addSpacer(10)
    const partner = w.addStack()
    partner.layoutVertically()
    addLine(partner, data.partner.display_name, { color: INK_SOFT, size: 12 })
    addLine(partner, `🔥 ${data.partner.current_streak}`, { color: HER_COLOR, size: 20, bold: true })
  }

  w.addSpacer()
  addLine(w, `❄️ ${data.freezes_available ?? 0} freezes`, { color: INK_SOFT, size: 11 })

  return w
}

const token = await getToken()
let widget
try {
  const data = await fetchData(token)
  widget = createWidget(data)
} catch (e) {
  widget = new ListWidget()
  widget.backgroundColor = new Color(PAPER)
  addLine(widget, "LevelUp", { color: INK_COLOR, size: 16, bold: true })
  addLine(widget, "Couldn't load — check your token in Settings.", { color: INK_SOFT, size: 12 })
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentSmall()
}
Script.complete()
