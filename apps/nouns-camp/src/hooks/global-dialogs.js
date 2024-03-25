import React from "react";

const Context = React.createContext();

export const Provider = ({ dialogs, children }) => {
  const [openDialogs, setOpenDialogs] = React.useState(new Map());

  const open = React.useCallback(
    (key, data) => {
      setOpenDialogs((prev) => {
        const next = new Map(prev);
        next.set(key, data ?? true);
        return next;
      });
    },
    [setOpenDialogs],
  );

  const close = React.useCallback(
    (key) => {
      setOpenDialogs((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
    [setOpenDialogs],
  );

  const toggle = React.useCallback(
    (key) => {
      setOpenDialogs((prev) => {
        const next = new Map(prev);

        if (next.has(key)) {
          next.delete(key);
          return next;
        }

        next.set(key, true);
        return next;
      });
    },
    [setOpenDialogs],
  );

  const contextValue = React.useMemo(
    () => ({ openDialogs, open, close, toggle }),
    [openDialogs, open, close, toggle],
  );

  return (
    <Context.Provider value={contextValue}>
      {children}
      <React.Suspense fallback={null}>
        {dialogs.map(({ key, component: DialogComponent }) =>
          openDialogs.has(key) ? (
            <DialogComponent
              key={key}
              isOpen={openDialogs.has(key)}
              close={() => close(key)}
            />
          ) : null,
        )}
      </React.Suspense>
    </Context.Provider>
  );
};

export const useDialog = (key) => {
  const { openDialogs, open, close, toggle } = React.useContext(Context);
  return {
    isOpen: openDialogs.has(key),
    data: openDialogs.get(key),
    open: React.useCallback((data) => open(key, data), [open, key]),
    close: React.useCallback(() => close(key), [close, key]),
    toggle: React.useCallback(() => toggle(key), [toggle, key]),
  };
};
