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
  return (
    <Excalidraw
      excalidrawAPI={excalidrawAPI}
      initialData={initialData}
      onChange={onChange}
      viewModeEnabled={viewModeEnabled}
      theme={theme}
      UIOptions={UIOptions}
    >
      {React.useMemo(() => (
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <HamburgerGridControls {...hamburgerProps} />
        </MainMenu>
      ), [hamburgerProps])}
    </Excalidraw>
  );
});

export default ExcalidrawWrapper;
