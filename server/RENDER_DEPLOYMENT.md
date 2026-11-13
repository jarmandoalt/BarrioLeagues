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

Después del primer despliegue, configura en Meta Developers el callback:

`https://<dominio-del-servicio>.onrender.com/api/webhook/button-response`

Usa el mismo `WHATSAPP_WEBHOOK_VERIFY_TOKEN` y suscribe la aplicación al campo `messages`. El webhook se sirve directamente desde el backend; no hace falta ejecutar `whatsappWebhookGateway.js` en Render.

## Frontend

El frontend debe publicarse por separado. En su servicio configura `VITE_API_URL` con:

`https://<dominio-del-servicio>.onrender.com/api`

Ese valor se utiliza durante el build del frontend. Si cambia el dominio del frontend, actualiza `CLIENT_ORIGIN` en el backend para que CORS y las cookies de administración acepten el nuevo origen.
