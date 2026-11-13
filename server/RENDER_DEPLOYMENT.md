# Despliegue del servidor en Render

El archivo `render.yaml` de la raíz crea el servicio web del backend. Conecta el repositorio en Render y selecciona **Apply** para que Render detecte el Blueprint. La configuración ya incluye:

- Directorio raíz: `server`
- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/api/health`

Render asigna `PORT` automáticamente; no lo agregues manualmente.

## Variables que debes proporcionar

Render te pedirá las variables marcadas como secretas o específicas del despliegue:

| Variable | Valor |
| --- | --- |
| `MONGO_URI` | URI de conexión de MongoDB Atlas. Asegúrate de permitir conexiones desde Render en la configuración de red de Atlas. |
| `CLIENT_ORIGIN` | Origen exacto del frontend publicado, por ejemplo `https://mi-app.onrender.com`, sin `/` al final. Para varios orígenes, sepáralos con comas. |
| `ADMIN_USERNAME` | Usuario de la cuenta administradora principal. |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt de la contraseña. Puedes generarlo localmente con `npm run admin:setup` desde `server` y copiar el valor de `ADMIN_PASSWORD_HASH` de tu `.env`; nunca publiques ese archivo. |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso de WhatsApp Cloud API. |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono en WhatsApp Cloud API. |
| `WHATSAPP_APP_SECRET` | App Secret de Meta; se usa para validar la firma de los webhooks. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token de verificación elegido por ti; debe coincidir con el configurado en Meta. |
| `ADMIN_WHATSAPP_NUMBER` | Teléfono del administrador con código de país, para recibir alertas. |
| `WHATSAPP_SCHEDULED_TEST_PHONE` | Teléfono con código de país para avisos programados, si se van a usar. |

`JWT_SECRET` se genera automáticamente. El Blueprint configura `NODE_ENV=production`, `TEST_MODE=false` y `ADMIN_COOKIE_SAME_SITE=none`; conserva esos valores en producción. No configures credenciales de MongoDB, Meta ni JWT en el código fuente.

## Webhook de WhatsApp

Después del despliegue, configura en Meta Developers el callback:

`https://barrioleagues.onrender.com/webhook`

Usa el mismo `WHATSAPP_WEBHOOK_VERIFY_TOKEN` y suscribe la aplicación al campo `messages`. El endpoint valida la firma con `WHATSAPP_APP_SECRET`, guarda los mensajes entrantes en la colección MongoDB `mensajes_recibidos` y procesa también las respuestas existentes de árbitros.

## Cron Job de Render

El Blueprint agrega el servicio `barrioleagues-scheduler`. Si lo configuras manualmente:

- **Tipo:** Cron Job
- **Root Directory:** `server`
- **Build Command:** `npm ci`
- **Command:** `npm run cron:run`
- **Schedule:** `* * * * *` (cada minuto)
- **Zona horaria:** UTC en Render; la lógica de avisos usa la configuración y las fechas guardadas en la liga.

Configura para el Cron Job el mismo `MONGO_URI` de Atlas y los mismos valores de `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_MATCH_TEMPLATE_NAME`, `WHATSAPP_MATCH_TEMPLATE_LANGUAGE`, `ADMIN_WHATSAPP_NUMBER` y `WHATSAPP_SCHEDULED_TEST_PHONE` que requiera la programación. El servicio web ya no ejecuta el scheduler en memoria.

El flujo de prueba del panel usa la constante `TEST_MODE = true` y envía todos sus mensajes al número fijo `524494481016`. El registro queda en MongoDB (`status: "test"`); el Cron Job consulta `dueAt` para continuar el flujo tras seis minutos aunque el Web Service se reinicie o duerma. Como Render ejecuta el Cron cada minuto, la continuación puede ocurrir hasta aproximadamente un minuto después de cumplirse el plazo.

El endpoint `POST /api/admin/test/flujo-completo` requiere una sesión del administrador principal y envía mensajes reales. El panel consulta `GET /api/admin/test/flujo-completo` para mostrar el estado.

## Frontend

El frontend debe publicarse por separado. En su servicio configura `VITE_API_URL` con:

`https://barrioleagues.onrender.com/api`

Ese valor se utiliza durante el build del frontend. Si cambia el dominio del frontend, actualiza `CLIENT_ORIGIN` en el backend para que CORS y las cookies de administración acepten el nuevo origen.
