# Actualizador Planner

Aplicación web local para trabajar con un Excel exportado de Planner y un Excel maestro. Permite revisar datos, filtrar tareas, validar el proyecto y crear una copia actualizada del Excel maestro sin backend ni subida de archivos.

## Instalación

```bash
npm install
```

## Ejecución en desarrollo

```bash
npm run dev
```

Abre la URL local que indique Vite.

## Compilación

```bash
npm run build
```

## Uso

1. Carga el `Excel de Planner (actual)`.
2. Carga el `Excel maestro`.
3. Revisa la planificación en `Vista Excel`, `Planner`, `Grid`, `Calendario` o `Maestro`.
4. Filtra por nombre, responsable individual y estado de fechas.
5. Valida que el proyecto detectado desde Planner coincide con el Excel maestro.
6. Usa `Crea Excel Maestro Actualizado` para descargar una copia nueva del maestro con los cambios validados.

La aplicación nunca sobrescribe el archivo original del usuario.
