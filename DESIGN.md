---
name: Find Food web
description: Sistema administrativo verde, compacto y orientado a operaciones.
colors:
  primary: "#1f7a5a"
  primary-hover: "#176246"
  ink: "#17332a"
  muted: "#66756f"
  border: "#dfe8e2"
  soft: "#e9f7f1"
  surface: "#ffffff"
  background: "#f7faf8"
  focus: "#8dcbb3"
  field: "#fbfdfc"
  status-green: "#1f7052"
  status-green-bg: "#e9f6ef"
  status-amber: "#805b17"
  status-amber-bg: "#fff3d8"
  status-red: "#a33f36"
  status-red-bg: "#fce9e5"
typography:
  headline:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.7px"
  title:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.5
  label:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  field: "8px"
  button: "9px"
  card: "14px"
  sidebar: "16px"
  pill: "999px"
spacing:
  compact: "8px"
  control: "12px"
  pair: "16px"
  card: "22px"
  section: "24px"
  shell-gap: "26px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "22px"
---

# Design System: Find Food web

## Overview

**Creative North Star: "Operación Find Food"**

La dirección fijada por el Figma mantiene verde, Inter, logotipo original, sidebar blanca, tablas de gestión y paneles laterales. El sistema usa superficies claras y densidad compacta para consultar registros y recorrer operaciones.

Documento extraído de `src/index.css`, `src/App.css` y `src/components/ui.tsx`. La fuente comprende 24 marcos web y 23 entradas de galería; recepción comparte implementación entre dos variaciones. La revisión es de fuente: el navegador remoto no pudo acceder a localhost y no se ha validado fidelidad visual.

**Key Characteristics:**
- Identidad verde e Inter local.
- Superficies blancas delimitadas por bordes suaves.
- Tablas compactas y detalle en panel lateral.

## Colors

### Primary
Verde operativo (`primary`) para acciones, enlaces, selección e indicadores; `primary-hover` oscurece la acción al pasar el puntero. `soft` acompaña estados activos sin competir con el texto.

### Neutral
`ink` sostiene títulos y contenido; `muted`, información secundaria. `surface` y `background` separan contenedores y lienzo; `border` delimita las regiones. `field` distingue los campos y `focus` señala el foco de teclado.

Los estados usan pares verde, ámbar y rojo con texto explícito. En esta implementación Badge asigna el tono según la etiqueta; son estados ilustrativos, no una taxonomía de negocio definitiva.

## Typography

Inter local, con Arial y sans-serif como alternativas. Pesos disponibles: regular (400), semibold (600) y bold (700). La jerarquía normativa está en el frontmatter; los textos de interfaz suelen usar 12–13px, las tablas 11px y los encabezados de tabla 10px. No existe un único token global de tamaño corporal.

Los títulos de página se adaptan a 30px desde 1600px, 23px hasta 1200px y 20px hasta 650px. Los paneles laterales usan título de 21px, reducido a 19px en móvil.

## Layout

Referencia de escritorio: 1440 × 1024. El contenedor alcanza 1920px, con margen exterior de 24px, separación de 26px y sidebar de 220px. Los contenidos usan tarjetas, métricas en cuatro columnas y regiones de dos columnas según la tarea.

Hasta 1200px se compactan separaciones y sidebar. Hasta 960px la navegación se abre como panel superpuesto y las regiones principales de dos columnas pasan a una. Hasta 650px las métricas quedan en dos columnas y dashboard, galería y postulantes en una; el margen exterior baja a 12px. Las tablas conservan desplazamiento horizontal. Los pares de campos permanecen en dos columnas, con separación reducida en móvil.

## Elevation & Depth

Las tarjetas son planas: fondo, borde y contraste tonal definen su posición. El panel lateral utiliza la única sombra estructural (`-12px 0 40px #17332a14`) y un fondo modal translúcido (`#17332a45`). La navegación móvil usa su propio velo (`#17332a50`).

## Shapes

Campos y controles icónicos suavemente redondeados; botones ligeramente más curvos, tarjetas amplias y sidebar con esquinas suaves. Los estados usan cápsulas y los avatares círculos. Los paneles laterales se alinean al borde derecho sin redondeo ornamental.

## Components

### Buttons
Acción primaria verde; secundaria blanca con borde suave; variante de peligro con texto rojo y borde rosado. Altura mínima de 42px. El foco visible tiene contorno de 3px y separación de 3px. La transición de fondo dura 0.15s. Los botones de operación deshabilitados usan opacidad 0.68 y cursor de indisponibilidad.

### Chips
Etiquetas de estado con relleno de 5px 10px, texto semibold de 10px y forma de cápsula. El color siempre acompaña la etiqueta escrita.

### Cards / Containers
Tarjetas blancas con borde de 1px, sin sombra; relleno de escritorio definido en los tokens. Los contenedores de tabla eliminan ese relleno para alinear filas y encabezados con el borde.

### Inputs / Fields
Campos con etiqueta asociada, borde suave de 1px y altura mínima de 42px; textarea con altura mínima de 112px y crecimiento vertical. Comparten el foco visible general. No se prescribe un estado de error que todavía no esté implementado.

### Navigation
Sidebar blanca; enlaces de 13px con icono lineal y estado activo verde sobre fondo suave. El panel móvil oculto tiene `visibility: hidden`, para evitar foco en enlaces fuera de pantalla. Mantener el logotipo original.

### Tables / Drawer
Tablas con encabezado gris verdoso, filas separadas y acciones de texto; hover muy tenue. El drawer usa `dialog` modal nativo, ancho de 500px limitado al viewport, altura de 100dvh, cuerpo desplazable y cabecera/pie separados por bordes. Escape cierra mediante navegación y la limpieza devuelve el foco anterior.

El indicador de carga gira en 0.8s. La preferencia de movimiento reducido desactiva animaciones y transiciones globales.

## Do's and Don'ts

### Do:
- **Do** reutilizar los tokens verdes, Inter y el logotipo original.
- **Do** conservar etiquetas, foco visible y texto en los estados.
- **Do** mantener tablas desplazables y detalle modal adaptable al viewport.

### Don't:
- **Don't** introducir una nueva identidad visual en las pantallas restantes.
- **Don't** presentar acciones deshabilitadas como operaciones realizadas.
- **Don't** afirmar validación visual o fidelidad píxel a píxel sin revisar el renderizado.
