#!/usr/bin/env bash
set -euo pipefail

stage="${1:?Supply the private release staging directory}"
case "$stage" in
  /root/commodity-desk-stage-*) ;;
  *) echo "Unexpected release staging directory" >&2; exit 1 ;;
esac

app_dir=/opt/commodity-desk
nginx_site=/etc/nginx/sites-available/oi-analyzer-https
api_snippet=/etc/nginx/snippets/commodity-desk-api.conf
ui_snippet=/etc/nginx/snippets/commodity-desk-ui.conf
auth_file=/etc/nginx/.commodity-desk.htpasswd

if [[ ! -s "$auth_file" ]]; then
  echo "Create $auth_file for HTTP Basic authentication before deploying" >&2
  exit 1
fi
if ! runuser -u www-data -- test -r "$auth_file"; then
  echo "Nginx worker cannot read $auth_file; grant its group read access" >&2
  exit 1
fi
if [[ ! -f /opt/stock-basket/.env ]]; then
  echo "The Stock Basket server environment is missing at /opt/stock-basket/.env" >&2
  exit 1
fi
if [[ ! -r /opt/oi-analyzer/.env ]]; then
  echo "The OI Analyzer token environment is missing or unreadable at /opt/oi-analyzer/.env" >&2
  exit 1
fi
if [[ ! -f "$app_dir/.env" && ! -f "$stage/commodity-desk.env" ]]; then
  echo "Private EIA key is missing. Set EIA_API_KEY in the local or server Commodity Desk .env" >&2
  exit 1
fi
if [[ ! -f "$nginx_site" ]] ||
   ! grep -Fq 'include /etc/nginx/snippets/commodity-desk-api.conf;' "$nginx_site" ||
   ! grep -Fq 'include /etc/nginx/snippets/commodity-desk-ui.conf;' "$nginx_site"; then
  echo "Add both Commodity Desk snippet includes to the existing HTTPS Nginx server block" >&2
  exit 1
fi

install -d -m 700 "$app_dir" "$app_dir/data"
tar -xzf "$stage/source.tar.gz" -C "$app_dir"
if [[ ! -f "$app_dir/.env" ]]; then
  install -m 600 "$stage/commodity-desk.env" "$app_dir/.env"
else
  echo "Preserved existing Commodity Desk environment"
fi
if [[ ! -x "$app_dir/.venv/bin/python" ]]; then
  python3 -m venv "$app_dir/.venv"
fi
"$app_dir/.venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir -r "$app_dir/deploy/requirements-deploy.txt"
"$app_dir/.venv/bin/python" -c 'from dotenv import dotenv_values; import sys; sys.exit(0 if dotenv_values("/opt/commodity-desk/.env").get("EIA_API_KEY") else 1)'

install -m 644 "$app_dir/deploy/commodity-desk.service" /etc/systemd/system/commodity-desk.service
systemctl daemon-reload
systemctl enable --now commodity-desk.service
systemctl restart commodity-desk.service

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 3 http://127.0.0.1:5004/api/health >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS --max-time 5 http://127.0.0.1:5004/api/health >/dev/null

install -d -m 755 /var/www/commodity-desk
cp -a "$app_dir/dist/." /var/www/commodity-desk/
chmod -R a+rX /var/www/commodity-desk
install -m 644 "$app_dir/deploy/nginx-commodity-desk-api.conf" "$api_snippet"
install -m 644 "$app_dir/deploy/nginx-commodity-desk-ui.conf" "$ui_snippet"
nginx -t
systemctl reload nginx

ui_code="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 10 https://165.227.84.87/commodity-desk/)"
api_code="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 10 https://165.227.84.87/commodity-desk-api/api/health)"
if [[ "$ui_code" != 401 || "$api_code" != 401 ]]; then
  echo "Expected protected HTTPS routes; received UI $ui_code and API $api_code" >&2
  exit 1
fi

rm -f "$stage/source.tar.gz" "$stage/commodity-desk.env" "$stage/setup-backend.sh"
rmdir "$stage"
echo "Commodity Desk frontend and API are healthy and access protected"
