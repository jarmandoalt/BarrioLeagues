# Sistema de Entrega de Horarios - BarrioLeagues

Este documento explica cómo usar el nuevo sistema de notificaciones de horarios para tu liga barrial.

## 📋 Tabla Oficial de Avisos

| Día del Partido | Aviso a Árbitros | Aviso a Capitanes |
|---|---|---|
| **LUNES** | Viernes 8am anterior | Lunes 8am |
| **MARTES** | Viernes 8am anterior | Lunes 8am |
| **MIÉRCOLES** | Viernes 8am anterior | Lunes 8am |
| **JUEVES** | Lunes 8am | Martes 8am |
| **VIERNES** | Martes 8am | Miércoles 8am |
| **SÁBADO** | Miércoles 8am | Jueves 8am |
| **DOMINGO** | Miércoles 8am | Jueves 8am |

## 🔧 Instalación

Las dependencias necesarias ya están instaladas:
- `dayjs` - Para manejo de fechas

Si necesitas reinstalarlas:
```bash
npm install dayjs
```

## ⚙️ Configuración

## Avance automático de jornadas

El cron revisa las fechas de `config.fechasJornadas` y avanza cada liga activa a la jornada cuya fecha de inicio ya llegó. Si el servidor estuvo detenido, se pone al corriente hasta la jornada que corresponda a la fecha actual.

Los partidos anteriores sin marcador permanecen en estado `programado` (mostrado como **Pendiente**). Si alguno quedó `en_curso` o `suspendido` sin marcador ni eventos, se devuelve a `programado`; los partidos finalizados o con resultado registrado no se modifican.

### En Producción

1. Abre el archivo `.env` en la carpeta `server/`
2. Asegúrate de que `TEST_MODE=false` (o no esté presente)
3. Configura tus credenciales de WhatsApp:
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_APP_SECRET`
   - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. En Meta Developers, configura el callback público como `https://<dominio>/webhook`, usa el mismo valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN` y suscribe la aplicación al campo `messages`.
5. En Render, configura el servicio Cron Job `barrioleagues-scheduler` con `npm run cron:run` y el schedule `* * * * *`; debe usar el mismo `MONGO_URI` de Atlas y las credenciales de WhatsApp que necesite el scheduler.

El Cron Job de Render revisa cada minuto si hay avisos con fecha y hora vencidas, y procesa las respuestas pendientes del flujo completo de prueba. Esto funciona aunque el Web Service se duerma.

Los árbitros pueden confirmar o rechazar con los botones de su plantilla, o responder por texto. Los capitanes pueden responder por texto con `SI` o `NO`; si tienen más de un partido pendiente, deben incluir el rol y el ID de seis dígitos, por ejemplo `CAPITAN SI 123456` o `ARBITRO NO 123456`. Las respuestas se guardan en `notifications_log`.

### En Modo Pruebas

1. En el archivo `.env`:
```env
TEST_MODE=true
```

2. Reinicia el servidor:
```bash
npm run dev
```

**En modo pruebas para las notificaciones programadas:**
- 1 hora real = 1 minuto en pruebas
- El Cron Job de Render se ejecuta cada 1 minuto
- 8 horas de confirmación del árbitro = 8 minutos
- Las notificaciones programadas no se envían realmente; solo se registran en consola y BD
- Para recibir respuestas reales, Meta debe tener configurado el webhook público y el servidor debe seguir accesible desde internet

El botón **PROBAR FLUJO COMPLETO (6 MIN)** del panel administrativo sí envía mensajes reales al número fijo de prueba `524494481016`, aunque `TEST_MODE=false`. Las ejecuciones y respuestas se guardan en MongoDB con `status: "test"`. El Cron Job puede continuar el flujo hasta aproximadamente un minuto después del plazo de seis minutos.

## 🧪 Pruebas - Endpoints Disponibles

### 1. **Simular Jornada**
Dispara inmediatamente toda la secuencia de notificaciones para una fecha específica.

```bash
curl -X POST http://localhost:5005/api/test/simular-jornada \
  -H "Content-Type: application/json" \
  -d '{
    "matchDate": "2025-01-18",
    "matchTime": "09:00",
    "leagueId": "barrio_test"
  }'
```

**Parámetros:**
- `matchDate` (requerido): Fecha del partido en formato `YYYY-MM-DD`
- `matchTime` (opcional): Hora del partido en formato `HH:mm`. Si no se proporciona, usa `09:00`
- `leagueId` (opcional): ID de la liga para filtrar

**Respuesta:**
```json
{
  "success": true,
  "message": "Simulación completada para 2 partido(s)",
  "matchesProcessed": [
    {
      "matchId": "ObjectId",
      "idPartido": "123456",
      "fecha": "2025-01-18",
      "hora": "09:00",
      "status": "notificaciones_enviadas"
    }
  ],
  "notificationsSent": 5,
  "notifications": [...]
}
```

### 2. **Ver Logs de Notificaciones**
Retorna todos los mensajes enviados en modo prueba.

```bash
# Ver todos los logs
curl http://localhost:5005/api/test/logs

# Filtrar por rol
curl http://localhost:5005/api/test/logs?role=arbitro

# Filtrar por estado
curl http://localhost:5005/api/test/logs?status=simulated

# Paginación
curl http://localhost:5005/api/test/logs?limit=50&skip=0
```

**Respuesta:**
```json
{
  "success": true,
  "total": 15,
  "count": 10,
  "page": {
    "current": 1,
    "size": 10,
    "hasMore": true
  },
  "logs": [
    {
      "id": "ObjectId",
      "to": "+52...",
      "role": "arbitro",
      "type": "schedule_notification",
      "message": "Hola María, tienes asignado el partido de...",
      "status": "simulated",
      "sent_at": null,
      "created_at": "2025-01-18T14:30:00Z",
      "metadata": {
        "match_date": "2025-01-18",
        "match_time": "09:00",
        "referee_name": "María González",
        "league_id": "barrio_test"
      }
    }
  ]
}
```

### 3. **Limpiar Logs de Prueba**
Borra todos los logs de prueba de la base de datos.

```bash
curl -X POST http://localhost:5005/api/test/limpiar-logs
```

**Respuesta:**
```json
{
  "success": true,
  "message": "25 logs de prueba eliminados",
  "deletedCount": 25
}
```

### 4. **Confirmar Árbitro**
Simula que un árbitro confirmó su asistencia al partido.

```bash
curl -X POST http://localhost:5005/api/test/confirmar-arbitro/[MATCH_ID]
```

**Parámetro:**
- `[MATCH_ID]`: ID del partido en la BD (MongoDB ObjectId)

**Respuesta:**
```json
{
  "success": true,
  "message": "Confirmación registrada para árbitro María González",
  "match": {
    "id": "ObjectId",
    "idPartido": "123456",
    "referee_confirmed": true,
    "referee_confirmed_at": "2025-01-18T14:30:00Z"
  },
  "confirmationLog": {...}
}
```

### 5. **Chequear Confirmaciones**
Ejecuta manualmente el chequeo de ábitros que no confirmaron en 8 horas (o 8 minutos en modo prueba).

```bash
curl -X POST http://localhost:5005/api/test/chequear-confirmaciones
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Chequeo de confirmaciones completado",
  "alertsGenerated": 2,
  "alerts": [
    {
      "to": "admin",
      "role": "admin",
      "type": "confirmation_reminder",
      "message": "[ALERTA] El árbitro Juan Pérez no ha confirmado el partido 123456...",
      "status": "simulated"
    }
  ]
}
```

### 6. **Información de Configuración**
Muestra la configuración actual del sistema de pruebas.

```bash
curl http://localhost:5005/api/test/info
```

**Respuesta:**
```json
{
  "testMode": true,
  "timeFactor": "1 hora real = 60 minutos en pruebas",
  "refereeConfirmationTime": "0.13 minutos en modo prueba (8 horas en producción)",
  "cronInterval": "Cada 1 minuto en modo prueba (cada 8:00 AM en producción)",
  "endpoints": {
    "POST /api/test/simular-jornada": "Simula la entrega de horarios para una fecha específica",
    "GET /api/test/logs": "Retorna todos los logs de notificaciones",
    ...
  }
}
```

## 🚀 Workflow de Pruebas Completo

### Paso 1: Activar Modo Pruebas
```bash
# En server/.env
TEST_MODE=true

# Reinicia el servidor
npm run dev
```

### Paso 2: Limpiar Logs Anteriores
```bash
curl -X POST http://localhost:5005/api/test/limpiar-logs
```

### Paso 3: Simular Jornada
```bash
curl -X POST http://localhost:5005/api/test/simular-jornada \
  -H "Content-Type: application/json" \
  -d '{"matchDate": "2025-01-18"}'
```

### Paso 4: Verificar Logs
```bash
curl http://localhost:5005/api/test/logs
```

Verás en la consola algo como:
```
[TEST] Mensaje a árbitro +52...: "Hola María, tienes asignado el partido..."
[TEST] Mensaje a capitán +52...: "Hola Juan, tu equipo Local tiene partido..."
```

### Paso 5: Simular Confirmación
```bash
# Obtén el match_id de los logs
curl -X POST http://localhost:5005/api/test/confirmar-arbitro/[MATCH_ID]
```

### Paso 6: Esperar 8 minutos y Chequear Alertas
```bash
# Espera 8 minutos (en modo prueba, equivale a 8 horas reales)
# Luego ejecuta:
curl -X POST http://localhost:5005/api/test/chequear-confirmaciones
```

Verás alertas para árbitros que no confirmaron.

## 📊 Base de Datos

### Tabla: `notifications_log`

Contiene todos los logs de notificaciones:

| Campo | Tipo | Descripción |
|---|---|---|
| `_id` | ObjectId | ID único |
| `match_id` | ObjectId | Referencia al partido |
| `to` | String | Teléfono o identificador del destinatario |
| `role` | String | `arbitro`, `capitan`, `admin` |
| `type` | String | `schedule_notification`, `confirmation_reminder`, `admin_alert` |
| `message` | String | El mensaje enviado |
| `status` | String | `sent`, `failed`, `simulated`, `pending` |
| `sent_at` | Date | Cuándo se envió realmente |
| `test_mode` | Boolean | Si fue en modo prueba |
| `error_message` | String | Mensaje de error si falló |
| `metadata` | Object | Información adicional (fecha, hora, nombres, etc.) |
| `created_at` | Date | Cuándo se registró |

## 🔄 Cron Job

El sistema ejecuta automáticamente:

**En Producción:**
- El Cron Job separado de Render se ejecuta cada minuto.
- Evalúa los avisos programados y procesa los flujos de prueba que hayan cumplido su plazo.
- La hora de envío se determina por la configuración de cada liga.

**En Modo Pruebas:**
- Cada **1 minuto**
- Verifica partidos de los próximos 7 días
- Las notificaciones programadas pueden quedar simuladas según `TEST_MODE`.
- El flujo del botón de prueba es independiente y envía mensajes reales al número fijo de prueba.

## 🎯 Características

✅ **Tabla oficial respetada al 100%** - Avisos exactamente en los días y horas configurados

✅ **Confirmación de árbitro** - 8 horas para confirmar, luego alerta al admin

✅ **Modo pruebas acelerado** - Prueba en minutos lo que en producción tarda días

✅ **Logs detallados** - Cada notificación se registra en la BD

✅ **Pruebas de notificaciones programadas** - Pueden ejecutarse en modo simulado

✅ **Endpoints de prueba** - Simula jornadas, confirma árbitros, ve logs

✅ **Flexible** - Fácil cambiar a producción quitando `TEST_MODE`

## 🐛 Troubleshooting

### Los logs no aparecen
- Verifica que `TEST_MODE=true` en `.env`
- Reinicia el servidor después de cambiar `.env`
- Revisa la consola para mensajes `[TEST]`

### El cron no ejecuta
- Verifica que MongoDB esté conectado
- Revisa los logs del servicio `barrioleagues-scheduler` en Render
- Confirma que el Cron Job use el mismo `MONGO_URI` y las credenciales requeridas

### Las notificaciones no se envían en producción
- Verifica credenciales de WhatsApp en `.env`
- Asegúrate que `TEST_MODE=false`
- Revisa los logs en la tabla `notificationlogs` con `status=failed`

### No se reciben respuestas de WhatsApp
- Verifica que Meta Developers apunte a `/webhook`, que el callback se haya verificado y que esté suscrito a `messages`
- Comprueba que `WHATSAPP_APP_SECRET` y `WHATSAPP_WEBHOOK_VERIFY_TOKEN` coincidan con la configuración de Meta
- Para respuestas de capitanes, verifica que el aviso outbound tenga estado `sent` o `delivered` en `notifications_log`

## 📝 Campos Agregados al Modelo Match

```javascript
referee_notified_at: Date    // Cuándo se notificó al árbitro
referee_confirmed: Boolean   // Si el árbitro confirmó
referee_confirmed_at: Date   // Cuándo confirmó
captains_notified_at: Date   // Cuándo se notificó a capitanes
```

## 🔒 Seguridad

- El endpoint del flujo completo requiere una sesión del administrador principal.
- Los datos del flujo se guardan en MongoDB con `status: "test"` y no modifican partidos reales.
- El flujo de prueba sí envía mensajes reales al número fijo `524494481016`; confirma las credenciales y la configuración de Meta antes de usarlo.

## 📞 Soporte

¿Problemas? Revisa:
1. La consola del servidor para mensajes de error
2. La tabla `notificationlogs` en MongoDB
3. El archivo `.env` para la configuración correcta
