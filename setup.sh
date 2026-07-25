#!/bin/bash
# wentric.uz bot — setup skripti
# Avtomatik: kutubxonalarni o'rnatadi → .env sozlaydi → xatolarni tekshiradi → ishga tushiradi

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_ok()    { echo -e "${GREEN}✅ $1${NC}"; }
print_err()   { echo -e "${RED}❌ $1${NC}"; }
print_warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
print_step()  { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║     wentric.uz rasmiy bot — Setup            ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ---- 1. Node.js ----
print_step "1-bosqich: Node.js tekshirish"
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  print_ok "Node.js: $NODE_VER"
else
  print_err "Node.js o'rnatilmagan!"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

# ---- 2. Papkalar ----
print_step "2-bosqich: Papkalarni yaratish"
mkdir -p data
print_ok "data/ papkasi tayyor"

# ---- 3. Kutubxonalar ----
print_step "3-bosqich: Kutubxonalarni o'rnatish"
if [ ! -d "node_modules" ]; then
  print_info "npm install boshlandi..."
  npm install --silent 2>&1 | tail -5
  print_ok "Kutubxonalar o'rnatildi"
else
  MISSING=""
  for pkg in "node-telegram-bot-api" "sqlite3" "node-cron" "axios" "dotenv" "sharp"; do
    [ ! -d "node_modules/$pkg" ] && MISSING="$MISSING $pkg"
  done
  if [ -n "$MISSING" ]; then
    print_warn "Yetishmayotgan: $MISSING"
    npm install --silent $MISSING 2>&1 | tail -3
    print_ok "Yetishmayotgan kutubxonalar o'rnatildi"
  else
    print_ok "Barcha kutubxonalar mavjud"
  fi
fi

# ---- 4. .env ----
print_step "4-bosqich: .env fayl sozlash"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"
need_write=0

if [ ! -f "$ENV_FILE" ] || [ ! -s "$ENV_FILE" ]; then
  [ -f "$ENV_EXAMPLE" ] && cp "$ENV_EXAMPLE" "$ENV_FILE" || touch "$ENV_FILE"
  need_write=1
fi

get_env() { grep "^$1=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '[:space:]'; }

BOT_TOKEN=$(get_env "BOT_TOKEN")
ADMIN_ID=$(get_env "ADMIN_ID")
OPENAI_KEY=$(get_env "OPENAI_API_KEY")
START_IMAGE=$(get_env "START_IMAGE")

if [ -z "$BOT_TOKEN" ]; then
  echo ""
  print_warn "BOT_TOKEN topilmadi!"
  echo "  Bot tokenini olish uchun:"
  echo "  1. Telegram'da @BotFather ga kiring"
  echo "  2. /newbot buyrug'ini bering"
  echo "  3. Bot nomi va username kiriting"
  echo ""
  read -p "  Bot tokenini kiriting: " BOT_TOKEN_INPUT
  BOT_TOKEN=$(echo "$BOT_TOKEN_INPUT" | tr -d '[:space:]')
  [ -z "$BOT_TOKEN" ] && { print_err "Token bo'sh!"; exit 1; }
  need_write=1
fi

if [ -z "$ADMIN_ID" ]; then
  echo ""
  print_warn "ADMIN_ID topilmadi!"
  echo "  @userinfobot ga yozing — sizga ID raqamini beradi."
  echo ""
  read -p "  Admin Telegram ID: " ADMIN_ID_INPUT
  ADMIN_ID=$(echo "$ADMIN_ID_INPUT" | tr -d '[:space:]')
  need_write=1
fi

if [ -z "$OPENAI_KEY" ]; then
  echo ""
  print_info "OPENAI_API_KEY ixtiyoriy (AI tahlil uchun)"
  echo "  Bo'lmasa, bot ichki tahlil ishlatadi."
  echo "  OpenAI kalit: https://platform.openai.com/api-keys"
  echo ""
  read -p "  OPENAI_API_KEY (Enter=o'tkazib): " OPENAI_INPUT
  OPENAI_KEY=$(echo "$OPENAI_INPUT" | tr -d '[:space:]')
  need_write=1
fi

if [ -z "$START_IMAGE" ]; then
  echo ""
  print_info "START_IMAGE — /start dagi rasm URL (ixtiyoriy)"
  echo ""
  read -p "  START_IMAGE URL (Enter=o'tkazib): " IMG_INPUT
  START_IMAGE=$(echo "$IMG_INPUT" | tr -d '[:space:]')
  need_write=1
fi

if [ "$need_write" = "1" ]; then
  cat > "$ENV_FILE" << EOF
BOT_TOKEN=$BOT_TOKEN
ADMIN_ID=$ADMIN_ID
OPENAI_API_KEY=$OPENAI_KEY
START_IMAGE=$START_IMAGE
EOF
  print_ok ".env yaratildi/yangilandi"
else
  print_ok ".env to'liq sozlangan"
fi

# ---- 5. Konfiguratsiyani tekshirish ----
print_step "5-bosqich: Konfiguratsiyani tekshirish"
BOT_TOKEN=$(get_env "BOT_TOKEN")
ADMIN_ID=$(get_env "ADMIN_ID")
[ -z "$BOT_TOKEN" ] && { print_err "BOT_TOKEN yo'q!"; exit 1; }
print_ok "BOT_TOKEN: ${BOT_TOKEN:0:8}...${BOT_TOKEN: -4}"
[ -z "$ADMIN_ID" ] && print_warn "ADMIN_ID yo'q" || print_ok "ADMIN_ID: $ADMIN_ID"

# ---- 6. Modullarni test ----
print_step "6-bosqich: Modullarni tekshirish"
TEST_RESULT=$(node -e "
const errors = [];
try { require('node-telegram-bot-api'); } catch(e) { errors.push('telegram'); }
try { require('sqlite3'); } catch(e) { errors.push('sqlite3'); }
try { require('node-cron'); } catch(e) { errors.push('cron'); }
try { require('axios'); } catch(e) { errors.push('axios'); }
try { require('dotenv'); } catch(e) { errors.push('dotenv'); }
try { require('sharp'); } catch(e) { errors.push('sharp'); }
if (errors.length) { console.log('MISSING:' + errors.join(',')); process.exit(1); }
console.log('OK');
" 2>&1)

if [ "$TEST_RESULT" = "OK" ]; then
  print_ok "Barcha modullar yuklandi"
else
  print_err "Modul xatolari: $TEST_RESULT"
  print_info "Qayta o'rnatish..."
  rm -rf node_modules package-lock.json
  npm install --silent 2>&1 | tail -5
  TEST2=$(node -e "try{require('node-telegram-bot-api');require('sqlite3');require('sharp');console.log('OK')}catch(e){console.log(e.message)}" 2>&1)
  [ "$TEST2" = "OK" ] && print_ok "Modullar yuklandi" || { print_err "Modullar yuklanmadi: $TEST2"; exit 1; }
fi

# ---- 7. DB init ----
print_step "7-bosqich: Ma'lumotlar bazasi"
DB_TEST=$(node -e "
const {init,db}=require('./db');
init();
setTimeout(()=>{
  db.all(\"SELECT name FROM sqlite_master WHERE type='table'\",(e,r)=>{
    if(e){console.log('ERR:'+e.message);process.exit(1);}
    console.log('TABLES:'+r.map(x=>x.name).join(','));
    process.exit(0);
  });
},500);
" 2>&1)

if [[ "$DB_TEST" == TABLES:* ]]; then
  print_ok "Baza: ${DB_TEST#TABLES:}"
else
  print_warn "Baza xatosi: $DB_TEST — qayta yaratish..."
  rm -f data/wentric.db
  DB2=$(node -e "
  const {init,db}=require('./db');
  init();
  setTimeout(()=>{
    db.all(\"SELECT name FROM sqlite_master WHERE type='table'\",(e,r)=>{
      if(e){console.log('ERR:'+e.message);process.exit(1);}
      console.log('TABLES:'+r.map(x=>x.name).join(','));
      process.exit(0);
    });
  },500);
  " 2>&1)
  [[ "$DB2" == TABLES:* ]] && print_ok "Baza qayta yaratildi: ${DB2#TABLES:}" || { print_err "Baza ishlamaydi: $DB2"; exit 1; }
fi

# ---- 8. Token validatsiya ----
print_step "8-bosqich: Bot tokenini tekshirish"
TOKEN_CHECK=$(node -e "
const axios=require('axios');
const t=process.env.BOT_TOKEN;
axios.get('https://api.telegram.org/bot'+t+'/getMe',{timeout:10000})
  .then(r=>console.log('OK:'+r.data.result.username))
  .catch(e=>console.log('ERR:'+(e.response?e.response.data.description:e.message)));
" 2>&1)

if [[ "$TOKEN_CHECK" == OK:* ]]; then
  print_ok "Bot faol: @${TOKEN_CHECK#OK:}"
elif [[ "$TOKEN_CHECK" == ERR:* ]]; then
  print_warn "Token tekshirilmadi: ${TOKEN_CHECK#ERR:}"
  print_info "Baribir davom etamiz"
else
  print_warn "Tekshiruv o'tmadi, davom etamiz"
fi

# ---- 9. systemd service o'rnatish ----
print_step "9-bosqich: systemd service sozlash"

SERVICE_NAME="wentric-bot"
SERVICE_SRC="$PROJECT_DIR/${SERVICE_NAME}.service"
SERVICE_DST="/etc/systemd/system/${SERVICE_NAME}.service"

CURRENT_USER="$(whoami)"
NODE_BIN="$(command -v node)"

# service faylini to'ldirish
sed -e "s|__USER__|${CURRENT_USER}|g" \
    -e "s|__PROJECT_DIR__|${PROJECT_DIR}|g" \
    -e "s|__NODE_BIN__|${NODE_BIN}|g" \
    "$SERVICE_SRC" > "${SERVICE_SRC}.tmp"
mv "${SERVICE_SRC}.tmp" "$SERVICE_SRC"
print_ok "Service fayli sozlandi: $SERVICE_SRC"

# systemd ga o'rnatish
if [ -w /etc/systemd/system ]; then
  cp "$SERVICE_SRC" "$SERVICE_DST"
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}.service" 2>/dev/null
  systemctl restart "${SERVICE_NAME}.service"
  sleep 2
  if systemctl is-active --quiet "${SERVICE_NAME}.service"; then
    print_ok "Bot systemd orqali ishga tushdi"
    print_info "Holat:  systemctl status ${SERVICE_NAME}"
    print_info "Log:   journalctl -u ${SERVICE_NAME} -f"
    print_info "Stop:  sudo systemctl stop ${SERVICE_NAME}"
    print_info "Start: sudo systemctl start ${SERVICE_NAME}"
  else
    print_err "Service ishga tushmadi — loglarni tekshiring:"
    systemctl status "${SERVICE_NAME}.service" --no-pager -l | tail -20
  fi
else
  print_warn "systemd ga o'rnatish uchun root huquqi kerak."
  print_info "Ishga tushirish uchun quyidagi buyruqlarni bajaring:"
  echo ""
  echo "  sudo cp $SERVICE_SRC $SERVICE_DST"
  echo "  sudo systemctl daemon-reload"
  echo "  sudo systemctl enable ${SERVICE_NAME}"
  echo "  sudo systemctl start ${SERVICE_NAME}"
  echo ""
  print_info "Yoki oddiy rejimda ishga tushiring:"
  echo "  node index.js"
fi

echo ""
echo -e "${GREEN}  ╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║     Setup muvaffaqiyatli yakunlandi!          ║${NC}"
echo -e "${GREEN}  ╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo "  Foydalanuvchi buyruqlari:"
echo "    /start, /profile, /editprofile, /dashboard, /mytasks"
echo "    /setrole, /litsenziy <ism>, /about, /history, /list"
echo "    /who (reply), /taskstatus <id>, /help"
echo ""
echo "  Admin buyruqlari:"
echo "    /admin, /add (reply), /addresident (reply), /assigntask (reply)"
echo "    /block <id>, /unblock <id>, /makeadmin <id>, /removeadmin <id>"
echo "    /deletemember <id>, /givelicense <id>, /search <q>, /stats"
echo "    /broadcast <text>, /roles, /setrole <id>, /ai, /setkey <key>"
echo "    /setprovider <p>, /testai, /analyze, /backup"
echo "    /setstartimage (reply), /setphoto <id> (reply)"
echo "    /setabout <text>, /sethistory <text>"
echo ""
echo "  systemd boshqaruvi:"
echo "    sudo systemctl status wentric-bot"
echo "    sudo systemctl restart wentric-bot"
echo "    sudo systemctl stop wentric-bot"
echo "    journalctl -u wentric-bot -f"
echo ""
