# Sistema "Curso de Capacitación" (Capacitacion-CEE)

Sistema de gestión, inscripción digital y validación de pagos para los cursos de formación continua del **Centro de Educación Alternativa "Martha Mendoza"** (Sucre, Bolivia).

![Logo CEE Martha Mendoza](/public/logo-cee.png)

---

## 📌 Características Principales

1. **Panel Principal de Control**:
   - Encabezado institucional con el logotipo oficial del CEA "Martha Mendoza".
   - Pestaña **"Participantes"** con buscador en tiempo real, filtro por estado de pago y métricas de recaudación.
   - Visores modales integrados para inspección detallada de **Cédula de Identidad (anverso/reverso o escaneado)** y **Comprobantes de Pago**.
   - Cambio rápido de estados de pago: `PENDIENTE`, `VERIFICADO`, `OBSERVADO`.
   - Exportación de la nómina completa a formato Excel (`.csv` optimizado).
   - Registro manual rápido de participantes desde el panel.

2. **Formulario de Inscripción Pública (`/inscripciones`)**:
   - Registro ágil y directo: Cédula de Identidad (CI), Nombres, Apellidos y Teléfono/WhatsApp.
   - Eliminación de formularios burocráticos y fichas complejas.
   - **Pago por QR Oficial de Banco BISA**:
     - Banco: Banco BISA
     - Cuenta: `4983644011`
     - Beneficiario: `TORREZ SANCHEZ MISAEL`
     - Motivo: `CURSOS DE FORMACIÓN CONTINUA`
     - Monto: `BOB 150.00`
     - Botón de descarga de imagen QR y copia de número de cuenta en un clic.
   - **Cédula de Identidad**: Opción para subir fotos de anverso y reverso, o archivo escaneado (PDF/imagen).
   - **Subida de Comprobante**: Carga directa con vista previa inmediata.
   - Módulo de **Consulta de Estado por CI** para que los inscritos verifiquen su aprobación.

3. **Base de Datos Supabase (`nueva_base_datos.sql`)**:
   - Tabla optimizada `participantes` con índices, triggers automáticos y políticas RLS públicas.
   - Configuración de almacenamiento en Supabase Storage (Buckets `comprobantes` y `carnets`).

---

## 🚀 Despliegue y Ejecución Local

### Prerrequisitos
- Node.js 18+ instalado.
- Proyecto en Supabase configurado con las variables en `.env.local`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
  ```

### Instalación y Ejecución
```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build
```

---

## 🗄️ Estructura del Proyecto

```text
├── public/
│   ├── logo-cee.png           # Logotipo del CEA Martha Mendoza
│   └── qr-pago-bisa.png       # QR oficial de Banco BISA (Bs. 150)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Layout general con metadatos del centro
│   │   ├── page.tsx           # Panel principal de administración
│   │   └── inscripciones/     # Ruta del formulario público
│   ├── components/
│   │   ├── participantes/     # Componente de gestión de participantes y visores
│   │   └── inscripciones/     # Componente de inscripción y QR de pago
│   ├── lib/
│   │   └── supabase/          # Cliente Supabase
│   └── types/                 # Definiciones de TypeScript
├── nueva_base_datos.sql       # Script SQL para Supabase
└── README.md
```
