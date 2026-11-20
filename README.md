# FinanzApp Pro

Aplicación web de finanzas personales con dashboard, ingresos y egresos, deudas, ahorros, tarjetas, préstamos grupales, categorías, importación/exportación y experiencia PWA responsive.

## Dos modos de acceso

Al abrir la app puedes elegir cómo continuar:

| Modo | Dónde funciona | Inicio de sesión | Dónde se guardan/sincronizan los datos |
|---|---|---|---|
| **Local · SQL Server** | Laboratorio Docker ejecutado en tu PC | Cuenta local con correo y contraseña; puedes registrarte desde la pantalla de acceso | API Node.js + Microsoft SQL Server del laboratorio, en el volumen Docker `sqlserver_data` |
| **En línea · Google** | GitHub Pages y también Docker | Inicio habitual con Google/Firebase Authentication | Firestore, asociado a la cuenta Google |
| **Invitado** | GitHub Pages | Sin cuenta | En el almacenamiento local del navegador; sin sincronización automática |

Las cuentas locales y las cuentas Google son independientes. **Los datos del modo SQL no se copian automáticamente a Firestore ni al contrario.** GitHub Pages es estático: conserva el modo Google/Firebase y no puede conectarse al SQL Server que está dentro de tu PC. La opción SQL se desactiva allí y la pantalla explica que requiere Docker.

Las contraseñas locales se guardan con derivación PBKDF2 y las sesiones usan una cookie HttpOnly. Esto es una implementación para laboratorio local; no expongas el puerto ni publiques el contenedor en Internet.

## Qué contiene el laboratorio

```text
Navegador (http://localhost:8080)
        │
        ▼
web — Nginx: sirve la SPA y reenvía /api/ al servicio API
        │
        ▼
api — Node.js: autenticación local y operaciones de datos
        │
        ▼
sqlserver — Microsoft SQL Server 2022: usuarios, sesiones y snapshots
        └── volumen Docker persistente: sqlserver_data
```

`init-db` es un servicio de ejecución única que espera SQL Server, crea la base `FinanzApp` y ejecuta `database/init.sql` de forma idempotente antes de iniciar la API. SQL Server se publica para SSMS sólo en `127.0.0.1:14330`; la API Node no se publica directamente al host. La web está vinculada a localhost en el puerto `8080` de forma predeterminada.

## Ejecutarlo en Windows 11 (paso a paso)

### 1. Instala Docker Desktop

1. Descarga Docker Desktop desde el sitio oficial de Docker e instálalo para Windows.
2. Durante la instalación, usa el backend recomendado **WSL 2** si el instalador lo ofrece. Si Windows pide reiniciar, reinicia.
3. Abre **Docker Desktop** desde el menú Inicio y espera a que indique que Docker está iniciado/funcionando. Déjalo abierto mientras uses FinanzApp.
4. Abre **PowerShell**. Comprueba que Docker responde:

   ```powershell
   docker --version
   docker compose version
   ```

   Si Windows dice que no reconoce `docker`, Docker Desktop todavía no terminó de instalarse o no está iniciado. Ábrelo, espera y vuelve a probar.

### 2. Extrae el ZIP completo

1. Descarga el ZIP de FinanzApp Pro y guárdalo, por ejemplo, en **Descargas**.
2. En el Explorador de archivos, clic derecho en el ZIP y selecciona **Extraer todo…**.
3. Elige una carpeta sencilla, por ejemplo `C:\Users\TU_USUARIO\Desktop\FinanzAppPro`, y pulsa **Extraer**.
4. Abre esa carpeta. La carpeta correcta es la que contiene directamente `docker-compose.yml`, `Dockerfile`, `index.html`, `.env.example` y `api`.
5. No ejecutes los comandos desde la carpeta interior equivocada. Para verificar el lugar, usa PowerShell con `Get-ChildItem -Force` y confirma que aparece `docker-compose.yml`.

### 3. Crea o comprueba `.env`

El archivo `.env` debe quedar **en la misma carpeta que `docker-compose.yml`**. El punto forma parte del nombre. No lo pongas dentro de `api`, `database` ni en el Escritorio por separado.

En PowerShell, después de entrar a la carpeta del proyecto:

```powershell
Set-Location "$HOME\Desktop\FinanzAppPro"
Get-ChildItem -Force
```

Si todavía no tienes `.env`, créalo desde la plantilla:

```powershell
Copy-Item .env.example .env
notepad .env
```

El archivo tendrá este formato:

```dotenv
MSSQL_SA_PASSWORD=Lab_Finanzas_2026!
FINANZAPP_PORT=8080
FINANZAPP_SQL_PORT=14330
```

No escribas comillas ni espacios alrededor de `=`. Si ya tenías una carpeta de laboratorio y un volumen `sqlserver_data` con información, conserva exactamente la contraseña `MSSQL_SA_PASSWORD` que usaste cuando se inicializó ese volumen; SQL Server no cambia la contraseña del usuario `sa` sólo porque modifiques `.env`. Si empiezas desde cero, reemplaza el valor de ejemplo por una contraseña propia que cumpla la política de SQL Server y guarda el archivo. No compartas `.env` ni lo subas a GitHub.

### 4. Inicia los contenedores

Asegúrate de que PowerShell sigue situado en la carpeta raíz del proyecto y que Docker Desktop está iniciado. Primero valida la configuración y luego construye/inicia el laboratorio:

```powershell
docker compose config
docker compose up -d --build
```

La primera ejecución descarga las imágenes y puede tardar varios minutos. Espera hasta que termine el comando. Después revisa los servicios:

```powershell
docker compose ps
```

Deben aparecer `sqlserver`, `init-db`, `api` y `web`. `init-db` es un trabajo de una sola vez: es normal que figure como `Exited (0)` cuando terminó correctamente. Los otros servicios deben figurar activos.

También puedes verlos en **Docker Desktop → Containers**. Ahí se observa el estado de cada contenedor y sus registros (logs). El navegador no se conecta directamente a SQL Server: se conecta a Nginx y Nginx reenvía las solicitudes `/api/` a Node.

### 5. Comprueba la base y abre la aplicación

Cuando `api` figure activo, comprueba que la base y las tablas están listas:

```powershell
docker compose exec api npm run db:check
```

La salida debe mostrar la base `FinanzApp`, las tablas de snapshots y las tablas `app_users` y `app_sessions`.

Abre esta dirección en Edge o Chrome:

```text
http://localhost:8080
```

Selecciona **Cuenta local · SQL Server** y luego **Crear una cuenta**. Usa un correo válido y una contraseña de al menos 10 caracteres. La cuenta local sólo pertenece a este laboratorio. Después puedes cerrar sesión y volver a entrar con el mismo correo y contraseña. Para usar Firestore, elige **Continuar con Google** en lugar de la cuenta local.

### 6. Ver la base desde SQL Server Management Studio (SSMS)

El SQL Server de Docker es otra instancia, separada de la instancia de Windows que ya puedas tener, por ejemplo `PCBRADY`. No reemplaza ni modifica `PCBRADY`.

1. Abre **SQL Server Management Studio (SSMS)** y selecciona **Conectar → Motor de base de datos**.
2. En **Nombre del servidor**, escribe exactamente `127.0.0.1,14330` (coma y puerto incluidos). También puedes usar `localhost,14330`.
3. En **Autenticación**, selecciona **Autenticación de SQL Server**.
4. En **Inicio de sesión**, escribe `sa`.
5. En **Contraseña**, escribe el valor de `MSSQL_SA_PASSWORD` que aparece en tu archivo `.env`.
6. Si SSMS muestra una opción de cifrado/certificado, marca **Confiar en el certificado del servidor** (Trust server certificate) para este laboratorio local.
7. Pulsa **Conectar**. En el panel **Explorador de objetos**, expande **Bases de datos → FinanzApp → Tablas**.

Consultas de inspección que puedes ejecutar en una ventana nueva de SSMS:

```sql
USE FinanzApp;
SELECT name AS tabla FROM sys.tables ORDER BY name;
SELECT email, display_name, created_at FROM dbo.app_users;
SELECT user_id, data_key, updated_at FROM dbo.financial_snapshots;
```

La contraseña de la cuenta local de FinanzApp no es la contraseña `sa`: son credenciales distintas. `sa` es la cuenta administrativa del motor SQL que se usa aquí para el laboratorio y para SSMS.

### 7. Detener, volver a iniciar y conservar datos

Desde PowerShell, dentro de la misma carpeta del proyecto:

```powershell
# Detiene y elimina los contenedores; conserva el volumen con la base de datos
docker compose down

# Vuelve a iniciar el laboratorio
docker compose up -d
```

Para seguir usando el mismo laboratorio otro día, abre Docker Desktop y ejecuta `docker compose up -d` desde la carpeta del proyecto. Para reconstruir la web/API después de actualizar archivos usa `docker compose up -d --build`.

**No ejecutes `docker compose down -v` si quieres conservar tus datos.** La opción `-v` elimina el volumen `sqlserver_data`, incluyendo usuarios, sesiones y snapshots financieros. Es un reinicio destructivo.

## Diagnóstico de problemas frecuentes

### `service "api" is not running`

Ese mensaje al ejecutar `docker compose exec api npm run db:check` significa que Docker no encuentra el contenedor API en ejecución; el comando de comprobación no lo inicia por sí mismo. Comprueba primero:

```powershell
docker compose ps -a
docker compose logs --tail 100 sqlserver init-db api
```

Busca el primer error. Si `sqlserver` no arrancó, revisa la contraseña de `.env` y que Docker Desktop tenga recursos suficientes. Si `init-db` falló, la API no se inicia porque depende de que la inicialización SQL termine correctamente. Si el error indica que la contraseña no es correcta y ya existía un volumen, restaura en `.env` la contraseña original usada para ese volumen. Corrige el problema y vuelve a ejecutar:

```powershell
docker compose up -d --build
docker compose ps
docker compose exec api npm run db:check
```

### No abre `http://localhost:8080`

Confirma que `web` aparece activo con `docker compose ps`. Si el puerto 8080 ya lo ocupa otra aplicación, cambia `FINANZAPP_PORT` en `.env`, por ejemplo a `8081`, vuelve a ejecutar `docker compose up -d` y abre `http://localhost:8081`.

### SSMS no conecta al puerto 14330

Asegúrate de que `sqlserver` esté activo y que `FINANZAPP_SQL_PORT=14330` esté en `.env`. Si el puerto está ocupado, cambia a `14331`, vuelve a crear el servicio (`docker compose up -d --force-recreate sqlserver`) y conecta SSMS a `127.0.0.1,14331`. No cambies el puerto interno `1433`.

### Quiero revisar qué guardó la API

```powershell
docker compose logs --tail 100 api
docker compose logs --tail 100 sqlserver
```

Para seguir los registros en tiempo real, añade `-f`; pulsa `Ctrl+C` para dejar de verlos. Eso detiene la lectura de logs, no los contenedores.

