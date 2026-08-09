'use client';

import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { HamburgerGridControls } from './HamburgerGridControls';

export default function ExcalidrawWrapper({
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
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <HamburgerGridControls {...hamburgerProps} />
      </MainMenu>
    </Excalidraw>
  );
}
