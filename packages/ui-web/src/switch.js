import { css } from "@emotion/react";
import { Switch as ReactAriaSwitch } from "react-aria-components";

const Switch = ({ label, size, align, variant, ...props }) => (
  <ReactAriaSwitch
    {...props}
    data-size={size}
    data-align={align}
    data-variant={variant}
    css={(t) =>
      css({
        display: "inline-flex",
        alignItems: "center",
        gap: "0.8rem",
        fontSize: t.text.sizes.base,
        color: t.colors.textNormal,
        cursor: "pointer",
        //   forced-color-adjust: none;
        ".indicator": {
          width: "3rem",
          height: "1.8rem",
          border: "0.2rem solid",
          borderColor: "transparent",
          background: t.colors.backgroundModifierContrast,
          borderRadius: "0.9rem",
          // transition: "background 0.2s",
          "&:before": {
            content: '""',
            display: "block",
            width: "1.4rem",
            height: "1.4rem",
            background: "white",
            borderRadius: "50%",
            transition: "transform 0.2s",
          },
        },
        '&[data-variant="light"] .indicator': {
          background: t.colors.backgroundModifierStrong,
        },
        "&[data-selected] .indicator": {
          background: t.colors.primary,
          "&:before": { transform: "translateX(calc(100% - 0.2rem))" },
        },
        "&[data-focus-visible] .indicator": {
          boxShadow: t.shadows.focus,
        },
        '&[data-size="small"]': {
          fontSize: t.text.sizes.small,
        },
        '&[data-align="right"]': {
          flexDirection: "row-reverse",
        },
      })
    }
  >
    <div className="indicator" />
    {label}
  </ReactAriaSwitch>
);

export default Switch;
