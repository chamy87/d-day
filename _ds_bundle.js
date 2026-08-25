/* @ds-bundle: {"format":4,"namespace":"DDayFantasyDesignSystem_0ed541","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"PlayerRow","sourcePath":"components/display/PlayerRow.jsx"},{"name":"PositionBadge","sourcePath":"components/display/PositionBadge.jsx"},{"name":"StatDelta","sourcePath":"components/display/StatDelta.jsx"},{"name":"Tag","sourcePath":"components/display/Tag.jsx"},{"name":"TierBreak","sourcePath":"components/display/TierBreak.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"}],"sourceHashes":{"components/core/Button.jsx":"8db4fd69ab3c","components/core/IconButton.jsx":"1c986ba2e6b8","components/core/Input.jsx":"4e6177a71597","components/core/Select.jsx":"82013bceb8dc","components/core/Switch.jsx":"d11d5f09ee12","components/core/Tabs.jsx":"5f92c6b7f3f3","components/display/Card.jsx":"e7d3aa37133b","components/display/PlayerRow.jsx":"333ef475868c","components/display/PositionBadge.jsx":"9e7a6adafa9b","components/display/StatDelta.jsx":"23ddf8c81a0e","components/display/Tag.jsx":"c00238338f1b","components/display/TierBreak.jsx":"f577a29a961b","components/feedback/Skeleton.jsx":"8414056fce77","components/feedback/Toast.jsx":"932e3b37417f","components/feedback/Tooltip.jsx":"c2f60ac34057","ui_kits/d-day/Dashboard.jsx":"ef63d05476b7","ui_kits/d-day/DraftRoom.jsx":"d367963ee48c","ui_kits/d-day/Landing.jsx":"5103bc2464c0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DDayFantasyDesignSystem_0ed541 = window.DDayFantasyDesignSystem_0ed541 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  icon,
  children,
  style,
  ...rest
}) {
  const base = {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    letterSpacing: '.01em',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    transition: 'background var(--dur-fast) var(--ease-snap),transform var(--dur-fast)',
    opacity: disabled ? .45 : 1,
    height: size === 'lg' ? 'var(--control-h-lg)' : size === 'sm' ? 28 : 'var(--control-h)',
    padding: size === 'lg' ? '0 20px' : size === 'sm' ? '0 10px' : '0 14px',
    fontSize: size === 'sm' ? 'var(--text-sm)' : 'var(--text-body-size)'
  };
  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--accent-ink)'
    },
    secondary: {
      background: 'var(--surface-raised)',
      color: 'var(--text-body)',
      borderColor: 'var(--border-strong)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)'
    },
    danger: {
      background: 'var(--reach-dim)',
      color: 'var(--reach)',
      borderColor: 'rgba(255,92,92,.35)'
    }
  };
  const [hover, setHover] = React.useState(false),
    [press, setPress] = React.useState(false);
  const hov = hover && !disabled ? variant === 'primary' ? {
    background: 'var(--accent-hover)'
  } : variant === 'ghost' ? {
    color: 'var(--text-body)',
    background: 'var(--bg-2)'
  } : {
    background: 'var(--bg-3)',
    filter: 'brightness(1.15)'
  } : {};
  const prs = press && !disabled ? {
    transform: 'translateY(1px)',
    ...(variant === 'primary' ? {
      background: 'var(--accent-press)'
    } : {})
  } : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
      ...base,
      ...variants[variant],
      ...hov,
      ...prs,
      ...style
    },
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false)
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  label,
  size = 'md',
  active,
  disabled,
  children,
  style,
  ...rest
}) {
  const d = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    disabled: disabled,
    style: {
      width: d,
      height: d,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'var(--accent-dim)' : hover && !disabled ? 'var(--bg-3)' : 'transparent',
      color: active ? 'var(--accent)' : hover ? 'var(--text-body)' : 'var(--text-muted)',
      border: '1px solid ' + (active ? 'rgba(255,180,61,.35)' : 'transparent'),
      borderRadius: 'var(--radius-sm)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .45 : 1,
      transition: 'all var(--dur-fast) var(--ease-snap)',
      ...style
    },
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  hint,
  mono,
  size = 'md',
  style,
  inputStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      letterSpacing: 'var(--track-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-faint)'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({}, rest, {
    onFocus: e => {
      setFocus(true);
      rest.onFocus && rest.onFocus(e);
    },
    onBlur: e => {
      setFocus(false);
      rest.onBlur && rest.onBlur(e);
    },
    style: {
      height: size === 'lg' ? 'var(--control-h-lg)' : 'var(--control-h)',
      background: 'var(--bg-1)',
      border: '1px solid ' + (focus ? 'var(--accent)' : 'var(--border-strong)'),
      borderRadius: 'var(--radius-sm)',
      color: 'var(--text-body)',
      padding: '0 12px',
      fontSize: size === 'lg' ? 16 : 'var(--text-body-size)',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
      outline: 'none',
      boxShadow: focus ? '0 0 0 3px var(--accent-dim)' : 'none',
      transition: 'all var(--dur-fast)',
      ...inputStyle
    }
  })), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-faint)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  label,
  options = [],
  value,
  onChange,
  size = 'md',
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      letterSpacing: 'var(--track-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-faint)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: 'none',
      WebkitAppearance: 'none',
      width: '100%',
      height: size === 'lg' ? 'var(--control-h-lg)' : 'var(--control-h)',
      background: 'var(--bg-1)',
      border: '1px solid ' + (focus ? 'var(--accent)' : 'var(--border-strong)'),
      borderRadius: 'var(--radius-sm)',
      color: 'var(--text-body)',
      padding: '0 32px 0 12px',
      fontSize: 'var(--text-body-size)',
      fontFamily: 'var(--font-body)',
      outline: 'none',
      boxShadow: focus ? '0 0 0 3px var(--accent-dim)' : 'none',
      cursor: 'pointer'
    }
  }, rest), options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--text-faint)',
      pointerEvents: 'none',
      fontSize: 10
    }
  }, "▼")));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
function Switch({
  checked,
  onChange,
  label,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .45 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": !!checked,
    tabIndex: 0,
    onKeyDown: e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        !disabled && onChange && onChange(!checked);
      }
    },
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 38,
      height: 22,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--accent)' : 'var(--bg-3)',
      border: '1px solid ' + (checked ? 'var(--accent)' : 'var(--border-strong)'),
      position: 'relative',
      transition: 'background var(--dur-fast) var(--ease-snap)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 18 : 2,
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: checked ? 'var(--accent-ink)' : 'var(--fg-2)',
      transition: 'left var(--dur-fast) var(--ease-snap)'
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-body)'
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  value,
  onChange,
  size = 'md',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'inline-flex',
      gap: 2,
      background: 'var(--bg-1)',
      border: '1px solid var(--line-1)',
      borderRadius: 'var(--radius-sm)',
      padding: 2,
      ...style
    }
  }, items.map(it => {
    const v = typeof it === 'string' ? it : it.value,
      l = typeof it === 'string' ? it : it.label,
      on = v === value;
    return /*#__PURE__*/React.createElement("button", {
      key: v,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(v),
      style: {
        height: size === 'sm' ? 24 : 30,
        padding: size === 'sm' ? '0 10px' : '0 14px',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
        letterSpacing: '.03em',
        textTransform: 'uppercase',
        background: on ? 'var(--surface-raised)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--text-muted)',
        boxShadow: on ? '0 1px 4px rgba(0,0,0,.4)' : 'none',
        transition: 'all var(--dur-fast)'
      }
    }, l);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function Card({
  title,
  action,
  pad = true,
  glow,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: glow ? 'var(--glow-accent)' : 'var(--shadow-card)',
      overflow: 'hidden',
      ...style
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '10px 16px',
      borderBottom: '1px solid var(--line-1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      letterSpacing: 'var(--track-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-faint)'
    }
  }, title), action), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: pad ? 'var(--card-pad)' : 0
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/PositionBadge.jsx
try { (() => {
const POS = {
  QB: 'var(--pos-qb)',
  RB: 'var(--pos-rb)',
  WR: 'var(--pos-wr)',
  TE: 'var(--pos-te)',
  K: 'var(--pos-k)',
  DEF: 'var(--pos-def)',
  FLEX: 'var(--pos-flex)',
  SFLX: 'var(--pos-flex)',
  BN: 'var(--fg-3)'
};
function PositionBadge({
  pos = 'FLEX',
  size = 'md',
  style
}) {
  const c = POS[pos] || 'var(--fg-3)';
  const s = size === 'sm' ? {
    fontSize: 9,
    padding: '1px 5px'
  } : {
    fontSize: 10,
    padding: '2px 7px'
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      letterSpacing: '.06em',
      color: c,
      background: 'color-mix(in srgb,' + (POS[pos] ? c : 'var(--fg-3)') + ' 14%,transparent)',
      border: '1px solid color-mix(in srgb,' + c + ' 40%,transparent)',
      borderRadius: 4,
      display: 'inline-block',
      lineHeight: 1.5,
      ...s,
      ...style
    }
  }, pos);
}
Object.assign(__ds_scope, { PositionBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/PositionBadge.jsx", error: String((e && e.message) || e) }); }

// components/display/StatDelta.jsx
try { (() => {
function StatDelta({
  value = 0,
  suffix = '',
  label,
  style
}) {
  const up = value > 0,
    flat = value === 0;
  const c = flat ? 'var(--text-faint)' : up ? 'var(--value)' : 'var(--reach)';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: c,
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 4,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", null, flat ? '·' : up ? '▲' : '▼', Math.abs(value), suffix), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-faint)',
      fontFamily: 'var(--font-body)'
    }
  }, label));
}
Object.assign(__ds_scope, { StatDelta });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/StatDelta.jsx", error: String((e && e.message) || e) }); }

// components/display/Tag.jsx
try { (() => {
function Tag({
  tone = 'neutral',
  children,
  style
}) {
  const tones = {
    neutral: {
      color: 'var(--text-muted)',
      background: 'var(--bg-3)',
      border: '1px solid var(--line-2)'
    },
    value: {
      color: 'var(--value)',
      background: 'var(--value-dim)',
      border: '1px solid rgba(61,220,151,.35)'
    },
    reach: {
      color: 'var(--reach)',
      background: 'var(--reach-dim)',
      border: '1px solid rgba(255,92,92,.35)'
    },
    accent: {
      color: 'var(--accent)',
      background: 'var(--accent-dim)',
      border: '1px solid rgba(255,180,61,.35)'
    },
    warn: {
      color: 'var(--warn)',
      background: 'rgba(255,210,61,.12)',
      border: '1px solid rgba(255,210,61,.3)'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 'var(--radius-pill)',
      display: 'inline-block',
      lineHeight: 1.6,
      whiteSpace: 'nowrap',
      ...tones[tone],
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/display/PlayerRow.jsx
try { (() => {
function PlayerRow({
  rank,
  name,
  pos = 'FLEX',
  team,
  bye,
  vbd,
  adpDelta,
  injury,
  drafted,
  onClick,
  trailing,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      minHeight: 44,
      cursor: onClick ? 'pointer' : 'default',
      background: hover && onClick ? 'var(--surface-raised)' : 'transparent',
      borderBottom: '1px solid var(--line-1)',
      opacity: drafted ? .35 : 1,
      textDecoration: drafted ? 'line-through' : 'none',
      transition: 'background var(--dur-fast)',
      ...style
    }
  }, rank != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-faint)',
      width: 24,
      textAlign: 'right',
      flexShrink: 0
    }
  }, rank), /*#__PURE__*/React.createElement(__ds_scope.PositionBadge, {
    pos: pos,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 'var(--text-body-size)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, name), injury && /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    tone: "reach"
  }, injury)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-faint)'
    }
  }, team, bye != null ? ' · BYE ' + bye : '')), vbd != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-body)',
      flexShrink: 0
    }
  }, vbd > 0 ? '+' : '', vbd), adpDelta != null && /*#__PURE__*/React.createElement(__ds_scope.StatDelta, {
    value: adpDelta,
    style: {
      flexShrink: 0
    }
  }), trailing);
}
Object.assign(__ds_scope, { PlayerRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/PlayerRow.jsx", error: String((e && e.message) || e) }); }

// components/display/TierBreak.jsx
try { (() => {
function TierBreak({
  tier = 1,
  note,
  style
}) {
  const c = 'var(--tier-' + Math.min(6, Math.max(1, tier)) + ')';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 12px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.1em',
      color: c,
      whiteSpace: 'nowrap'
    }
  }, "TIER ", tier), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'linear-gradient(90deg,' + c + ' 0%,transparent 100%)',
      opacity: .6
    }
  }), note && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-faint)',
      whiteSpace: 'nowrap'
    }
  }, note));
}
Object.assign(__ds_scope, { TierBreak });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/TierBreak.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function Skeleton({
  width = '100%',
  height = 16,
  round,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "dday-skeleton",
    style: {
      display: 'block',
      width,
      height,
      borderRadius: round ? 'var(--radius-pill)' : 'var(--radius-sm)',
      ...style
    }
  });
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function Toast({
  tone = 'neutral',
  title,
  children,
  style
}) {
  const c = tone === 'value' ? 'var(--value)' : tone === 'reach' ? 'var(--reach)' : tone === 'accent' ? 'var(--accent)' : 'var(--fg-2)';
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-strong)',
      borderLeft: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-pop)',
      padding: '10px 14px',
      maxWidth: 360,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: c,
      marginTop: 5,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 'var(--text-sm)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, children)));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  children,
  style
}) {
  const [show, setShow] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      ...style
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      bottom: 'calc(100% + 6px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-3)',
      border: '1px solid var(--border-strong)',
      color: 'var(--text-body)',
      fontSize: 'var(--text-xs)',
      padding: '4px 8px',
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-pop)',
      zIndex: 50
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// ui_kits/d-day/Dashboard.jsx
try { (() => {
const DashDS = window.DDayFantasyDesignSystem_0ed541;
const STARTERS = [{
  n: 'Joe Burrow',
  p: 'QB',
  tm: 'CIN vs PIT',
  pr: 22.4
}, {
  n: 'Bijan Robinson',
  p: 'RB',
  tm: 'ATL @ CAR',
  pr: 19.8
}, {
  n: 'James Cook',
  p: 'RB',
  tm: 'BUF vs NYJ',
  pr: 15.1,
  risk: 'Q · ankle'
}, {
  n: 'Nico Collins',
  p: 'WR',
  tm: 'HOU @ IND',
  pr: 16.6
}, {
  n: 'Drake London',
  p: 'WR',
  tm: 'ATL @ CAR',
  pr: 14.9
}, {
  n: 'Trey McBride',
  p: 'TE',
  tm: 'ARI vs SEA',
  pr: 12.3
}];
const WAIVERS = [{
  n: 'Tyjae Spears',
  p: 'RB',
  tm: 'TEN',
  note: '+41% rostered · lead-back window',
  faab: '$14'
}, {
  n: 'Ricky Pearsall',
  p: 'WR',
  tm: 'SF',
  note: 'Target share up 3 straight weeks',
  faab: '$8'
}, {
  n: 'Tucker Kraft',
  p: 'TE',
  tm: 'GB',
  note: 'TE1 snaps since Week 4',
  faab: '$5'
}];
const NEWS = [{
  t: 'Cook (ankle) limited Wednesday; game-time call',
  s: 'FantasySP · 2h'
}, {
  t: 'Robinson clears 100 scrimmage yards in 5 straight',
  s: 'ESPN · 4h'
}, {
  t: 'McBride sees season-high 11 targets',
  s: 'ESPN · 1d'
}];
function Dashboard({
  onDraft
}) {
  const {
    Card,
    Tabs,
    Tag,
    PositionBadge,
    Button,
    StatDelta
  } = DashDS;
  const [tab, setTab] = React.useState('START/SIT');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 16px',
      borderBottom: '1px solid var(--line-1)',
      background: 'var(--surface-panel)'
    }
  }, /*#__PURE__*/React.createElement(window.Wordmark, {
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "The Gridiron Gentlemen \xB7 Week 8"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Tabs, {
    items: ['START/SIT', 'MATCHUP', 'WAIVERS', 'NEWS'],
    value: tab,
    onChange: setTab,
    size: "sm"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: onDraft
  }, "← Draft room")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      flex: 1,
      minHeight: 0,
      overflowY: 'auto'
    }
  }, tab === 'START/SIT' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 300px',
      gap: 14,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Your starters — projected (half PPR)",
    pad: false
  }, STARTERS.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.n,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 12px',
      borderBottom: '1px solid var(--line-1)',
      minHeight: 44
    }
  }, /*#__PURE__*/React.createElement(PositionBadge, {
    pos: s.p,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14,
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, s.n, s.risk && /*#__PURE__*/React.createElement(Tag, {
    tone: "reach"
  }, s.risk)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, s.tm)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      fontSize: 14
    }
  }, s.pr.toFixed(1))))), /*#__PURE__*/React.createElement(Card, {
    title: "Flags"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Tag, {
    tone: "reach"
  }, "RISK"), " Cook is a game-time call — ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-body)'
    }
  }, "Tyjae Spears"), " projects within 1.2 pts."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Tag, {
    tone: "value"
  }, "START"), " London draws the league's worst WR coverage. ", /*#__PURE__*/React.createElement(StatDelta, {
    value: 3,
    label: "proj vs avg"
  }))))), tab === 'MATCHUP' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14,
      alignItems: 'start'
    }
  }, [{
    t: 'Your team',
    pts: '101.1',
    rows: STARTERS
  }, {
    t: 'BigDawgs',
    pts: '96.4',
    rows: STARTERS.slice().reverse()
  }].map((side, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    title: side.t,
    pad: false,
    action: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color: i === 0 ? 'var(--value)' : 'var(--text-muted)'
      }
    }, side.pts)
  }, side.rows.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.n,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderBottom: '1px solid var(--line-1)'
    }
  }, /*#__PURE__*/React.createElement(PositionBadge, {
    pos: s.p,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 13,
      fontWeight: 600
    }
  }, s.n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13
    }
  }, s.pr.toFixed(1))))))), tab === 'WAIVERS' && /*#__PURE__*/React.createElement(Card, {
    title: "Waiver targets — trending ∩ unrostered",
    pad: false,
    style: {
      maxWidth: 640
    }
  }, WAIVERS.map(w => /*#__PURE__*/React.createElement("div", {
    key: w.n,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderBottom: '1px solid var(--line-1)'
    }
  }, /*#__PURE__*/React.createElement(PositionBadge, {
    pos: w.p,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14
    }
  }, w.n, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)',
      fontWeight: 400,
      fontSize: 12
    }
  }, w.tm)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, w.note)), /*#__PURE__*/React.createElement(Tag, {
    tone: "neutral"
  }, "FAAB ", w.faab)))), tab === 'NEWS' && /*#__PURE__*/React.createElement(Card, {
    title: "News — your players",
    pad: false,
    style: {
      maxWidth: 640
    }
  }, NEWS.map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '10px 12px',
      borderBottom: '1px solid var(--line-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, n.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, n.s))))), /*#__PURE__*/React.createElement("footer", {
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      padding: '8px 16px',
      borderTop: '1px solid var(--line-1)'
    }
  }, "Data: Sleeper \xB7 nflverse (CC-BY) \xB7 FantasyFootballCalculator \xB7 FantasyCalc \xB7 Boris Chen"));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/d-day/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/d-day/DraftRoom.jsx
try { (() => {
const DraftDS = window.DDayFantasyDesignSystem_0ed541;
const BOARD = [{
  t: 1,
  players: [{
    r: 7,
    n: 'Bijan Robinson',
    p: 'RB',
    tm: 'ATL',
    b: 5,
    v: 62,
    d: 3
  }, {
    r: 8,
    n: 'CeeDee Lamb',
    p: 'WR',
    tm: 'DAL',
    b: 7,
    v: 58,
    d: -2
  }]
}, {
  t: 2,
  players: [{
    r: 9,
    n: 'Drake London',
    p: 'WR',
    tm: 'ATL',
    b: 5,
    v: 44,
    d: 11,
    inj: 'Q'
  }, {
    r: 10,
    n: 'Josh Jacobs',
    p: 'RB',
    tm: 'GB',
    b: 10,
    v: 41,
    d: 6
  }, {
    r: 11,
    n: 'Jayden Daniels',
    p: 'QB',
    tm: 'WAS',
    b: 12,
    v: 39,
    d: 14
  }, {
    r: 12,
    n: 'Trey McBride',
    p: 'TE',
    tm: 'ARI',
    b: 8,
    v: 36,
    d: -4
  }]
}, {
  t: 3,
  players: [{
    r: 13,
    n: 'DK Metcalf',
    p: 'WR',
    tm: 'PIT',
    b: 5,
    v: 28,
    d: 2
  }, {
    r: 14,
    n: 'Joe Burrow',
    p: 'QB',
    tm: 'CIN',
    b: 10,
    v: 27,
    d: 8
  }, {
    r: 15,
    n: 'James Cook',
    p: 'RB',
    tm: 'BUF',
    b: 7,
    v: 25,
    d: -6
  }]
}];
const TICKER = [{
  p: '3.04',
  t: 'Team Riley',
  n: 'Puka Nacua',
  pos: 'WR'
}, {
  p: '3.03',
  t: 'BigDawgs',
  n: 'Jahmyr Gibbs',
  pos: 'RB'
}, {
  p: '3.02',
  t: 'Waiver Wire Warriors',
  n: 'Amon-Ra St. Brown',
  pos: 'WR'
}, {
  p: '3.01',
  t: 'ChampsOnly',
  n: 'Justin Jefferson',
  pos: 'WR'
}];
function DraftRoom({
  onDashboard
}) {
  const {
    Card,
    PlayerRow,
    TierBreak,
    Tabs,
    Switch,
    Tag,
    PositionBadge,
    Button,
    Toast
  } = DraftDS;
  const [pos, setPos] = React.useState('ALL');
  const [hide, setHide] = React.useState(true);
  const [drafted, setDrafted] = React.useState([]);
  const pick = n => setDrafted(d => [...d, n]);
  const rows = BOARD.map(g => ({
    ...g,
    players: g.players.filter(pl => (pos === 'ALL' || pl.p === pos) && !(hide && drafted.includes(pl.n)))
  })).filter(g => g.players.length);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 16px',
      borderBottom: '1px solid var(--line-1)',
      background: 'var(--surface-panel)'
    }
  }, /*#__PURE__*/React.createElement(window.Wordmark, {
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "The Gridiron Gentlemen"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--accent-dim)',
      border: '1px solid rgba(255,180,61,.4)',
      borderRadius: 'var(--radius-pill)',
      padding: '4px 14px',
      animation: 'dday-pulse 2s infinite'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--accent)'
    }
  }, "On the clock"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      fontSize: 18,
      color: 'var(--accent)'
    }
  }, "1:24"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, "pick 3.07 \xB7 you're up in 2")), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: onDashboard
  }, "Dashboard →")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      padding: 14,
      flex: 1,
      minHeight: 0,
      alignItems: 'stretch'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Best available",
    pad: false,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    },
    action: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      size: "sm",
      items: ['ALL', 'QB', 'RB', 'WR', 'TE'],
      value: pos,
      onChange: setPos
    }), /*#__PURE__*/React.createElement(Switch, {
      checked: hide,
      onChange: setHide,
      label: "Hide drafted"
    }))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflowY: 'auto',
      flex: 1
    }
  }, rows.map(g => /*#__PURE__*/React.createElement(React.Fragment, {
    key: g.t
  }, /*#__PURE__*/React.createElement(TierBreak, {
    tier: g.t,
    note: g.players.length + ' left'
  }), g.players.map(pl => /*#__PURE__*/React.createElement(PlayerRow, {
    key: pl.n,
    rank: pl.r,
    name: pl.n,
    pos: pl.p,
    team: pl.tm,
    bye: pl.b,
    vbd: pl.v,
    adpDelta: pl.d,
    injury: pl.inj,
    drafted: drafted.includes(pl.n),
    onClick: () => pick(pl.n)
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 320,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      flexShrink: 0,
      minHeight: 0,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Suggested pick",
    glow: true,
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(PositionBadge, {
    pos: "QB"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 16
    }
  }, "Jayden Daniels"), /*#__PURE__*/React.createElement(Tag, {
    tone: "value"
  }, "VALUE +14")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)',
      marginTop: 6
    }
  }, "Superflex league and your SFLX slot is empty — QBs thin out after this tier.")), /*#__PURE__*/React.createElement(Card, {
    title: "My roster",
    pad: false,
    style: {
      flexShrink: 0
    }
  }, [['QB', 'Joe Burrow — CIN'], ['RB', 'Bijan Robinson — ATL'], ['RB', null], ['WR', 'Nico Collins — HOU'], ['WR', null], ['TE', null], ['FLEX', null], ['SFLX', null]].map(([slot, who], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 12px',
      borderBottom: '1px solid var(--line-1)'
    }
  }, /*#__PURE__*/React.createElement(PositionBadge, {
    pos: slot,
    size: "sm"
  }), who ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, who) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-faint)'
    }
  }, "Empty", (slot === 'RB' || slot === 'SFLX') && /*#__PURE__*/React.createElement(Tag, {
    tone: "warn",
    style: {
      marginLeft: 8
    }
  }, "NEED"))))), /*#__PURE__*/React.createElement(Toast, {
    tone: "warn",
    title: "Scarcity",
    style: {
      flexShrink: 0
    }
  }, "Only 2 RBs left in Tier 2."))), /*#__PURE__*/React.createElement("footer", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      padding: '8px 16px',
      borderTop: '1px solid var(--line-1)',
      background: 'var(--surface-panel)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--text-faint)',
      flexShrink: 0
    }
  }, "Recent picks"), TICKER.map(t => /*#__PURE__*/React.createElement("span", {
    key: t.p,
    style: {
      display: 'inline-flex',
      gap: 6,
      alignItems: 'center',
      fontSize: 12,
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-faint)'
    }
  }, t.p), /*#__PURE__*/React.createElement(PositionBadge, {
    pos: t.pos,
    size: "sm"
  }), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-body)',
      fontWeight: 600
    }
  }, t.n), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)'
    }
  }, t.t)))));
}
window.DraftRoom = DraftRoom;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/d-day/DraftRoom.jsx", error: String((e && e.message) || e) }); }

// ui_kits/d-day/Landing.jsx
try { (() => {
const DS = window.DDayFantasyDesignSystem_0ed541;
function Wordmark({
  size = 22
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStretch: '125%',
      fontWeight: 850,
      fontSize: size,
      letterSpacing: '-.02em',
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)'
    }
  }, "D-"), "DAY");
}
function Landing({
  onEnter
}) {
  const {
    Button,
    Input,
    Card,
    Tag,
    PositionBadge
  } = DS;
  const [id, setId] = React.useState('');
  const [found, setFound] = React.useState(false);
  const lookup = () => {
    if (id.trim()) setFound(true);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 72
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 'var(--track-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-faint)',
      marginTop: 10
    }
  }, "Fantasy football draft assistant"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'var(--text-muted)',
      marginTop: 14,
      maxWidth: 440
    }
  }, "Paste your Sleeper league ID. No login, no setup — rankings tuned to your league's exact scoring and roster.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-end',
      width: '100%',
      maxWidth: 480
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Sleeper league ID",
    mono: true,
    size: "lg",
    placeholder: "992093874321055744",
    value: id,
    onChange: e => setId(e.target.value),
    style: {
      flex: 1
    },
    onKeyDown: e => e.key === 'Enter' && lookup()
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: lookup
  }, "Find league")), found && /*#__PURE__*/React.createElement(Card, {
    title: "League detected",
    style: {
      width: '100%',
      maxWidth: 480
    },
    action: /*#__PURE__*/React.createElement(Tag, {
      tone: "accent"
    }, "DRAFTING")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStretch: '125%',
      fontWeight: 850,
      fontSize: 20
    }
  }, "The Gridiron Gentlemen"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Tag, null, "12 teams"), /*#__PURE__*/React.createElement(Tag, null, "Half PPR"), /*#__PURE__*/React.createElement(Tag, null, "Superflex"), /*#__PURE__*/React.createElement(Tag, null, "Snake \xB7 pick 3.07")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginTop: 12,
      flexWrap: 'wrap'
    }
  }, ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SFLX', 'K', 'DEF', 'BN', 'BN'].map((p, i) => /*#__PURE__*/React.createElement(PositionBadge, {
    key: i,
    pos: p,
    size: "sm"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    style: {
      width: '100%'
    },
    onClick: onEnter
  }, "Enter draft room →"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      marginTop: 'auto'
    }
  }, "Data: Sleeper \xB7 nflverse \xB7 FantasyFootballCalculator \xB7 FantasyCalc \xB7 Boris Chen"));
}
Object.assign(window, {
  Landing,
  Wordmark
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/d-day/Landing.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.PlayerRow = __ds_scope.PlayerRow;

__ds_ns.PositionBadge = __ds_scope.PositionBadge;

__ds_ns.StatDelta = __ds_scope.StatDelta;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.TierBreak = __ds_scope.TierBreak;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

})();
