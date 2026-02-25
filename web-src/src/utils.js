/*
 * Client-side utilities for the Brand CSS Token Manager
 *
 * Includes:
 *   - CSS token helpers (flattenObject, toKebabCase, toCssVariables)
 *   - Schema loader (loadSchema)
 *   - Action invocation helper (actionWebInvoke)
 */

// ---------------------------------------------------------------------------
// CSS Token Helpers  (mirrors actions/utils.js — no server round-trip needed)
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a nested token object into kebab-joined keys.
 * CSS-like leaf values (hex colors, px/rem sizes, rgb()) are not recursed.
 *
 * @param {object} obj
 * @param {string} prefix
 * @returns {object} flat key → value map
 */
export function flattenObject (obj, prefix = '') {
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    const k = prefix ? `${prefix}-${key}` : key
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !isCssValue(value)
    ) {
      Object.assign(out, flattenObject(value, k))
    } else {
      out[k] = value
    }
  }
  return out
}

/**
 * Returns true if a value should be treated as a CSS leaf (no recursion).
 * @param {*} v
 * @returns {boolean}
 */
export function isCssValue (v) {
  if (Array.isArray(v)) return true
  if (
    typeof v === 'string' &&
    (v.startsWith('rgb') ||
      v.startsWith('#') ||
      v.includes('px') ||
      v.includes('rem'))
  ) {
    return true
  }
  return false
}

/**
 * Convert camelCase / PascalCase to kebab-case.
 * @param {string} str
 * @returns {string}
 */
export function toKebabCase (str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s._]+/g, '-')
    .toLowerCase()
}

/**
 * Build a CSS `:root {}` block of custom properties from a flat key-value map.
 *
 * @param {object} flat   - flat key → value pairs
 * @param {string} prefix - CSS variable prefix, e.g. '--brand-'
 * @returns {string} full CSS text
 */
export function toCssVariables (flat, prefix = '--brand-') {
  const lines = []
  const pre = prefix.endsWith('-') ? prefix : `${prefix}-`
  for (const [key, value] of Object.entries(flat)) {
    const varName = pre + toKebabCase(String(key))
    const cssValue = typeof value === 'string' ? value : JSON.stringify(value)
    lines.push(`  ${varName}: ${cssValue};`)
  }
  return `:root {\n${lines.join('\n')}\n}\n`
}

// ---------------------------------------------------------------------------
// Schema — inlined for reliability (no network fetch required)
// ---------------------------------------------------------------------------

const INLINE_SCHEMA = {
  colors: {
    primary:       { type: 'color',  default: '#e87722', label: 'Primary Color' },
    secondary:     { type: 'color',  default: '#003865', label: 'Secondary Color' },
    background:    { type: 'color',  default: '#ffffff', label: 'Background' },
    surface:       { type: 'color',  default: '#f5f5f5', label: 'Surface' },
    error:         { type: 'color',  default: '#d32f2f', label: 'Error' },
    onPrimary:     { type: 'color',  default: '#ffffff', label: 'On Primary' },
    onSecondary:   { type: 'color',  default: '#ffffff', label: 'On Secondary' },
    textPrimary:   { type: 'color',  default: '#212121', label: 'Text Primary' },
    textSecondary: { type: 'color',  default: '#757575', label: 'Text Secondary' }
  },
  typography: {
    fontFamilyBase:    { type: 'string', default: '"Source Sans Pro", Arial, sans-serif', label: 'Font Family' },
    fontSizeBase:      { type: 'size',   default: '16px', label: 'Base Font Size' },
    fontSizeSmall:     { type: 'size',   default: '12px', label: 'Small Font Size' },
    fontSizeLarge:     { type: 'size',   default: '20px', label: 'Large Font Size' },
    fontWeightRegular: { type: 'string', default: '400',  label: 'Weight Regular' },
    fontWeightBold:    { type: 'string', default: '700',  label: 'Weight Bold' },
    lineHeightBase:    { type: 'string', default: '1.5',  label: 'Line Height' }
  },
  spacing: {
    xs:  { type: 'size', default: '4px',  label: 'XS (4px)' },
    sm:  { type: 'size', default: '8px',  label: 'SM (8px)' },
    md:  { type: 'size', default: '16px', label: 'MD (16px)' },
    lg:  { type: 'size', default: '24px', label: 'LG (24px)' },
    xl:  { type: 'size', default: '32px', label: 'XL (32px)' },
    xxl: { type: 'size', default: '48px', label: 'XXL (48px)' }
  },
  borderRadius: {
    small:  { type: 'size',   default: '4px',    label: 'Small (4px)' },
    medium: { type: 'size',   default: '8px',    label: 'Medium (8px)' },
    large:  { type: 'size',   default: '16px',   label: 'Large (16px)' },
    pill:   { type: 'string', default: '9999px', label: 'Pill (9999px)' }
  },
  shadows: {
    card:  { type: 'string', default: '0 2px 4px rgba(0,0,0,0.12)', label: 'Card Shadow' },
    modal: { type: 'string', default: '0 8px 24px rgba(0,0,0,0.2)', label: 'Modal Shadow' }
  },
  breakpoints: {
    mobile:  { type: 'size', default: '480px',  label: 'Mobile' },
    tablet:  { type: 'size', default: '768px',  label: 'Tablet' },
    desktop: { type: 'size', default: '1024px', label: 'Desktop' },
    wide:    { type: 'size', default: '1280px', label: 'Wide' }
  }
}

let _schemaCache = null

/**
 * Return the token schema.
 * First tries to fetch token-schema.json (allows runtime overrides);
 * falls back to the inlined INLINE_SCHEMA so the app always works.
 *
 * @returns {Promise<object>} the parsed schema object
 */
export async function loadSchema () {
  if (_schemaCache) return _schemaCache
  try {
    const res = await fetch('./token-schema.json')
    if (res.ok) {
      _schemaCache = await res.json()
      return _schemaCache
    }
  } catch (e) {
    console.warn('token-schema.json fetch failed, using inlined schema', e)
  }
  _schemaCache = INLINE_SCHEMA
  return _schemaCache
}

/**
 * Build a default token object from the schema (all values set to schema defaults).
 * @param {object} schema - parsed token-schema.json
 * @returns {object} token object with default values
 */
export function buildDefaultTokens (schema) {
  const tokens = {}
  for (const [category, fields] of Object.entries(schema)) {
    tokens[category] = {}
    for (const [key, def] of Object.entries(fields)) {
      tokens[category][key] = def.default
    }
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Action Invocation Helper
// ---------------------------------------------------------------------------

/**
 * Invoke an Adobe I/O Runtime web action.
 *
 * @param {string} actionUrl  - full action URL
 * @param {object} headers    - HTTP headers (e.g. Authorization)
 * @param {object} params     - query/body parameters
 * @param {string} [method]   - HTTP method (default: 'POST')
 * @returns {Promise<object>} parsed JSON response body
 */
export async function actionWebInvoke (actionUrl, headers = {}, params = {}, method = 'POST') {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }

  if (method === 'GET') {
    const qs = new URLSearchParams(params).toString()
    const url = qs ? `${actionUrl}?${qs}` : actionUrl
    const res = await fetch(url, opts)
    return _handleResponse(res)
  }

  opts.body = JSON.stringify(params)
  const res = await fetch(actionUrl, opts)
  return _handleResponse(res)
}

async function _handleResponse (res) {
  let data
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await res.json()
  } else {
    data = await res.text()
  }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

export default actionWebInvoke