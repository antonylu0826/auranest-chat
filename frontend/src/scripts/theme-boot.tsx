/**
 * Boot script that reads user preference values from cookies / localStorage
 * and applies data-attributes to <html> before hydration to prevent flicker.
 *
 * Exported as a raw code string so that layout.tsx can embed it via
 * dangerouslySetInnerHTML directly on a <script> element inside <head>.
 * This avoids the React 19 "Encountered a script tag" warning which fires
 * when a <script> is returned from a React component function.
 */
import { PREFERENCE_DEFAULTS, PREFERENCE_PERSISTENCE } from "@/lib/preferences/preferences-config";

function buildCode(): string {
  const persistence = JSON.stringify({
    theme_mode: PREFERENCE_PERSISTENCE.theme_mode,
    theme_preset: PREFERENCE_PERSISTENCE.theme_preset,
    font: PREFERENCE_PERSISTENCE.font,
    content_layout: PREFERENCE_PERSISTENCE.content_layout,
    navbar_style: PREFERENCE_PERSISTENCE.navbar_style,
    sidebar_variant: PREFERENCE_PERSISTENCE.sidebar_variant,
    sidebar_collapsible: PREFERENCE_PERSISTENCE.sidebar_collapsible,
  });
  const defaults = JSON.stringify({
    theme_mode: PREFERENCE_DEFAULTS.theme_mode,
    theme_preset: PREFERENCE_DEFAULTS.theme_preset,
    font: PREFERENCE_DEFAULTS.font,
    content_layout: PREFERENCE_DEFAULTS.content_layout,
    navbar_style: PREFERENCE_DEFAULTS.navbar_style,
    sidebar_variant: PREFERENCE_DEFAULTS.sidebar_variant,
    sidebar_collapsible: PREFERENCE_DEFAULTS.sidebar_collapsible,
  });

  return `(function(){try{
var root=document.documentElement;
var P=${persistence};
var D=${defaults};
function rc(n){var m=document.cookie.split("; ").find(function(c){return c.startsWith(n+"=");});return m?decodeURIComponent(m.split("=")[1]):null;}
function rl(n){try{return window.localStorage.getItem(n);}catch(e){return null;}}
function rp(k,fb){var mode=P[k],v=null;if(mode==="localStorage")v=rl(k);if(!v&&(mode==="client-cookie"||mode==="server-cookie"))v=rc(k);return(v&&typeof v==="string")?v:fb;}
var rawMode=rp("theme_mode",D.theme_mode);
var valid=rawMode==="dark"||rawMode==="light"||rawMode==="system";
var mode=valid?rawMode:D.theme_mode;
var resolved=mode==="system"&&window.matchMedia?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):mode;
root.classList.toggle("dark",resolved==="dark");
root.setAttribute("data-theme-mode",mode);
root.setAttribute("data-theme-preset",rp("theme_preset",D.theme_preset));
root.setAttribute("data-font",rp("font",D.font));
root.setAttribute("data-content-layout",rp("content_layout",D.content_layout));
root.setAttribute("data-navbar-style",rp("navbar_style",D.navbar_style));
root.setAttribute("data-sidebar-variant",rp("sidebar_variant",D.sidebar_variant));
root.setAttribute("data-sidebar-collapsible",rp("sidebar_collapsible",D.sidebar_collapsible));
root.style.colorScheme=resolved==="dark"?"dark":"light";
}catch(e){console.warn("ThemeBootScript error:",e);}})();`;
}

export const themeBootCode = buildCode();
