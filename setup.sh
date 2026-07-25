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

# ---- 1. Node.js tekshirish ----
print_step "1-bosqich: Node.js tekshirish"

if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  print_ok "Node.js topildi: $NODE_VER"
else
  print_err "Node.js o'rnatilmagan!"
  print_info "O'rnatish uchun:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  print_warn "Node.js 18+ tavsiya etiladi, sizda $NODE_VER"
fi

# ---- 2. data papkasi ----
print_step "2-bosqich: Papkalarni yaratish"

if [ ! -d "data" ]; then
  mkdir -p data
  print_ok "data/ papkasi yaratildi"
else
  print_ok "data/ papkasi mavjud"
fi

# ---- 3. Kutubxonalarni o'rnatish ----
print_step "3-bosqich: Kutubxonalarni o'rnatish"

if [ ! -d "node_modules" ]; then
  print_info "npm install boshlandi (biroz kuting)..."
  npm install --silent 2>&1 | tail -5
  print_ok "Kutubxonalar o'rnatildi"
else
  print_info "node_modules mavjud, to'liqlik tekshirilmoqda..."
  MISSING=""
  for pkg in "node-telegram-bot-api" "sqlite3" "node-cron" "axios" "dotenv" "sharp"; do
    if [ ! -d "node_modules/$pkg" ]; then
      MISSING="$MISSING $pkg"
    fi
  done
  if [ -n "$MISSING" ]; then
    print_warn "Yetishmayotgan: $MISSING"
    npm install --silent $MISSING 2>&1 | tail -3
    print_ok "Yetishmayotgan kutubxonalar o'rnatildi"
  else
    print_ok "Barcha kutubxonalar mavjud"
  fi
fi

# ---- 4. .env sozlash ----
print_step "4-bosqich: .env fayl sozlash"

ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"

need_write=0

# .env yo'q bo'lsa yoki bo'sh bo'lsa
if [ ! -f "$ENV_FILE" ] || [ ! -s "$ENV_FILE" ]; then
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
  need_write=1
fi

# BOT_TOKEN tekshirish
get_env() { grep "^$1=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '[:space:]'; }

BOT_TOKEN=$(get_env "BOT_TOKEN")
ADMIN_ID=$(get_env "ADMIN_ID")
OPENAI_KEY=$(get_env "OPENAI_API_KEY")

if [ -z "$BOT_TOKEN" ]; then
  echo ""
  print_warn "BOT_TOKEN topilmadi!"
  echo ""
  echo "  Bot tokenini olish uchun:"
  echo "  1. Telegram'da @BotFather ga kiring"
  echo "  2. /newbot buyrug'ini bering"
  echo "  3. Bot nomi va username kiriting"
  echo "  4. Sizga token beriladi (format: 123456:ABC-DEF...)"
  echo ""
  read -p "  Bot tokenini kiriting: " BOT_TOKEN_INPUT
  BOT_TOKEN=$(echo "$BOT_TOKEN_INPUT" | tr -d '[:space:]')
  if [ -z "$BOT_TOKEN" ]; then
    print_err "Token bo'sh! Setup to'xtatildi."
    echo "  Keyin qayta urinib ko'ring: ./setup.sh"
    exit 1
  fi
  need_write=1
fi

if [ -z "$ADMIN_ID" ]; then
  echo ""
  print_warn "ADMIN_ID topilmadi!"
  echo ""
  echo "  Sizning Telegram ID raqamingizni olish uchun:"
  echo "  1. Telegram'da @userinfobot ga yozing"
  echo "  2. U sizga ID raqamini yuboradi (masalan: 123456789)"
  echo ""
  read -p "  Admin Telegram ID raqamini kiriting: " ADMIN_ID_INPUT
  ADMIN_ID=$(echo "$ADMIN_ID_INPUT" | tr -d '[:space:]')
  if [ -z "$ADMIN_ID" ]; then
    print_warn "ADMIN_ID kiritilmadi, keyin qo'shishingiz mumkin"
  fi
  need_write=1
fi

if [ -z "$OPENAI_KEY" ]; then
  echo ""
  print_info "OPENAI_API_KEY ixtiyoriy (AI tahlil uchun)"
  echo "  Bo'lmasa, bot o'zining ichki tahlilini ishlatadi."
  echo "  OpenAI kalit: https://platform.openai.com/api-keys"
  echo ""
  read -p "  OPENAI_API_KEY ni kiriting (o'tkazib o'tish uchun Enter): " OPENAI_INPUT
  OPENAI_KEY=$(echo "$OPENAI_INPUT" | tr -d '[:space:]')
  need_write=1
fi

if [ "$need_write" = "1" ]; then
  cat > "$ENV_FILE" << EOF
BOT_TOKEN=$BOT_TOKEN
ADMIN_ID=$ADMIN_ID
OPENAI_API_KEY=$OPENAI_KEY
EOF
  print_ok ".env fayl yaratildi/yangilandi"
else
  print_ok ".env fayl to'liq sozlangan"
fi

# ---- 5. .env ni tekshirish ----
print_step "5-bosqich: Konfiguratsiyani tekshirish"

BOT_TOKEN=$(get_env "BOT_TOKEN")
ADMIN_ID=$(get_env "ADMIN_ID")

if [ -z "$BOT_TOKEN" ]; then
  print_err "BOT_TOKEN hali ham yo'q!"
  exit 1
fi
print_ok "BOT_TOKEN: ${BOT_TOKEN:0:8}...${BOT_TOKEN: -4}"

if [ -z "$ADMIN_ID" ]; then
  print_warn "ADMIN_ID yo'q — admin buyruqlar ishlamaydi!"
else
  print_ok "ADMIN_ID: $ADMIN_ID"
fi

# ---- 6. Modullarni test qilish ----
print_step "6-bosqich: Modullarni tekshirish"

TEST_RESULT=$(node -e "
const errors = [];
try { require('node-telegram-bot-api'); } catch(e) { errors.push('node-telegram-bot-api'); }
try { require('sqlite3'); } catch(e) { errors.push('sqlite3'); }
try { require('node-cron'); } catch(e) { errors.push('node-cron'); }
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
  TEST_RESULT2=$(node -e "try{require('node-telegram-bot-api');require('sqlite3');require('sharp');console.log('OK')}catch(e){console.log(e.message)}" 2>&1)
  if [ "$TEST_RESULT2" = "OK" ]; then
    print_ok "Qayta o'rnatishdan keyin modullar yuklandi"
  else
    print_err "Modullar hali ham yuklanmadi: $TEST_RESULT2"
    exit 1
  fi
fi

# ---- 7. DB init test ----
print_step "7-bosqich: Ma'lumotlar bazasini tekshirish"

DB_TEST=$(node -e "
const {init,db}=require('./db');
init();
setTimeout(()=>{
  db.all(\"SELECT name FROM sqlite_master WHERE type='table'\",(e,r)=>{
    if(e){console.log('ERR:'+e.message);process.exit(1);}
    const tables=r.map(x=>x.name).join(',');
    console.log('TABLES:'+tables);
    process.exit(0);
  });
},500);
" 2>&1)

if [[ "$DB_TEST" == TABLES:* ]]; then
  print_ok "Baza jadvallari: ${DB_TEST#TABLES:}"
else
  print_err "Baza xatosi: $DB_TEST"
  print_info "DB faylni o'chirib qayta..."
  rm -f data/wentric.db
  DB_TEST2=$(node -e "
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
  if [[ "$DB_TEST2" == TABLES:* ]]; then
    print_ok "Baza qayta yaratildi: ${DB_TEST2#TABLES:}"
  else
    print_err "Baza ishlamayapti: $DB_TEST2"
    exit 1
  fi
fi

# ---- 8. Token validatsiya ----
print_step "8-bosqich: Bot tokenini tekshirish"

TOKEN_CHECK=$(node -e "
const axios=require('axios');
const t=process.env.BOT_TOKEN;
axios.get('https://api.telegram.org/bot'+t+'/getMe',{timeout:10000})
  .then(r=>{console.log('OK:'+r.data.result.username)})
  .catch(e=>{console.log('ERR:'+(e.response?e.response.data.description:e.message))});
" 2>&1)

if [[ "$TOKEN_CHECK" == OK:* ]]; then
  print_ok "Bot faol: @${TOKEN_CHECK#OK:}"
elif [[ "$TOKEN_CHECK" == ERR:* ]]; then
  print_warn "Token tekshirilmadi: ${TOKEN_CHECK#ERR:}"
  print_info "Internet bo'lmasa yoki token noto'g'ri bo'lishi mumkin"
  print_info "Baribir ishga tushirib ko'ramiz"
else
  print_warn "Token tekshiruvi o'tmadi, baribir davom etamiz"
fi

# ---- 9. Ishga tushirish ----
print_step "9-bosqich: Botni ishga tushirish"

echo ""
echo -e "${GREEN}  ╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║     Setup muvaffaqiyatli yakunlandi!          ║${NC}"
echo -e "${GREEN}  ║     Bot ishga tushmoqda...                    ║${NC}"
echo -e "${GREEN}  ╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo "  Bot buyruqlari:"
echo "    /start         — boshlang'ich xabar"
echo "    /litsenziy <ism> — a'zo kartochkasi"
echo "    /list          — a'zolar ro'yxati"
echo "    /about         — jamoa haqida"
echo "    /history       — jamoa tarixi"
echo "    /add           — a'zo qo'shish (admin)"
echo "    /addresident   — rezident qo'shish (admin)"
echo "    /analyze       — AI tahlil (admin)"
echo "    /backup        — db backup (admin)"
echo ""
echo "  To'xtatish uchun: Ctrl+C"
echo ""

exec node index.js
