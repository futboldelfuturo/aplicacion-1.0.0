# 🌐 Cambiar URL de Netlify

## Opción 1: Cambiar nombre del sitio (desde terminal)

```powershell
# Ver sitios actuales
netlify sites:list

# Cambiar nombre del sitio
netlify sites:update --name futbol-del-futuro
```

Esto cambiará la URL a: **https://futbol-del-futuro.netlify.app**

## Opción 2: Cambiar desde el Dashboard de Netlify

1. Ve a: https://app.netlify.com
2. Selecciona tu sitio "FutbolDelFuturo"
3. Ve a: **Site settings** → **General** → **Site details**
4. Haz clic en **Change site name**
5. Cambia el nombre a: `futbol-del-futuro`
6. Guarda los cambios

## Opción 3: Usar dominio personalizado

Si quieres un dominio completamente personalizado:

1. Ve a: **Site settings** → **Domain management**
2. Haz clic en **Add custom domain**
3. Ingresa tu dominio (ej: `futboldelfuturo.com`)
4. Sigue las instrucciones para configurar DNS

---

## 📝 Nota

- El nombre del sitio debe ser único en Netlify
- Solo puede contener letras minúsculas, números y guiones
- La URL será: `https://[nombre-del-sitio].netlify.app`

---

¡Después de cambiar el nombre, tu URL será más acorde a tu aplicación! 🚀

