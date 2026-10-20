'use client';

import React from 'react';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { HamburgerGridControls } from './HamburgerGridControls';

const ExcalidrawWrapper = React.memo(function ExcalidrawWrapper({
  excalidrawAPI,
  initialData,
  onChange,
  viewModeEnabled,
  theme,
  UIOptions,
  hamburgerProps,
}: any) {
  const mainMenu = React.useMemo(
    () => (
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <HamburgerGridControls {...hamburgerProps} />
      </MainMenu>
    ),
    [hamburgerProps],
  );

  return (
    <Excalidraw
      excalidrawAPI={excalidrawAPI}
      initialData={initialData}
      onChange={onChange}
      viewModeEnabled={viewModeEnabled}
      theme={theme}
      UIOptions={UIOptions}
    >
      {mainMenu}
    </Excalidraw>
  );
});

export default ExcalidrawWrapper;
