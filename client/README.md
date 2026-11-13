# Cliente BarrioLeagues

## Desarrollo local

El cliente usa `/api` y Vite reenvía las peticiones a `https://barrioleagues.onrender.com` por defecto. Esto mantiene la cookie de sesión en el mismo origen local y evita depender de cookies de terceros.

Para usar un backend local, establece `VITE_API_PROXY_TARGET=http://localhost:5005` en `client/.env.development.local`. Reinicia Vite después de cambiar esta variable.

## Producción

Al compilar el cliente para publicarlo por separado, configura `VITE_API_URL=https://barrioleagues.onrender.com/api` en el entorno de build del servicio frontend.
