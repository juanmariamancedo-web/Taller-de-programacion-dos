Aquí tienes una guía clara y paso a paso en formato Markdown para que puedas compartirsela directamente a tu compañero o agregarla al archivo `README.md` del repositorio.

---

# 🚀 Guía de Inicio Rápido para Colaboradores

Sigue estos pasos para clonar el proyecto y levantar el entorno de desarrollo local con Docker y Electron.

---

### 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu equipo:

* **[Git](https://git-scm.com/)**
* **[Node.js](https://nodejs.org/)** (Versión 18 o superior)
* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** *(Asegúrate de iniciar la aplicación después de instalarla)*

---

### 1️⃣ Clonar el Repositorio

Abre tu terminal (PowerShell, CMD o WSL) y ejecuta:

```bash
git clone <https://github.com/juanmariamancedo-web/Taller-de-programacion-dos>
cd mi-taller-app

```

---

### 2️⃣ Configurar las Variables de Entorno

Crea un archivo llamado **`.env`** en la raíz del proyecto (al mismo nivel que `package.json`) y agrega la cadena de conexión a la base de datos de Docker:

```env
DATABASE_URL="postgresql://admin:admin123@localhost:5432/taller_db?schema=public"

```

---

### 3️⃣ Instalar Dependencias Locales

Instala los paquetes necesarios para correr Electron y las herramientas del proyecto:

```bash
npm install

```

---

### 4️⃣ Levatamiento de Infraestructura con Docker

Asegúrate de que **Docker Desktop** esté abierto y corriendo. Luego, levanta el contenedor de PostgreSQL y las herramientas de desarrollo ejecutando:

```bash
docker compose up -d

```

> **Nota:** La primera vez puede demorar unos minutos descargando las imágenes de PostgreSQL y construyendo el contenedor de soporte.

---

### 5️⃣ Sincronizar la Base de Datos y Generar Prisma

Una vez que los contenedores estén corriendo, aplica la estructura del esquema (`schema.prisma`) a la base de datos y genera el cliente de TypeScript:

```bash
npx prisma db push
npx prisma generate

```

---

### 6️⃣ Iniciar la Aplicación

Con el backend en Docker corriendo en segundo plano, lanza la aplicación de Electron en modo desarrollo:

```bash
npm run dev

```

---

### 🛠️ Servicios Disponibles en Desarrollo

Mientras Docker esté encendido (`docker compose up -d`), tendrás acceso a estas herramientas desde tu navegador:

* 📊 **Prisma Studio** *(Explorador visual de la BD)*: `http://localhost:5555`
* 🗄️ **Adminer** *(Gestor tradicional de PostgreSQL)*: `http://localhost:8080`
* **Sistema:** PostgreSQL
* **Servidor:** `postgres`
* **Usuario:** `admin`
* **Contraseña:** `admin123`
* **Base de datos:** `taller_db`



---

### 💡 Comandos Útiles de Docker

* **Detener los contenedores:** `docker compose down`
* **Ver el estado de los contenedores:** `docker compose ps`
* **Ver logs si hay algún fallo:** `docker compose logs -f`