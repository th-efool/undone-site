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
  isMobile,
}: any) {
  // On mobile: zen mode hides the built-in toolbar entirely.
  // We render our own MobileCanvasToolbar instead (see CanvasScreen).
  const mobileUIOptions = isMobile
    ? {
        canvasActions: {
          changeViewBackgroundColor: false,
          clearCanvas: false,
          loadScene: false,
          saveToActiveFile: false,
          toggleTheme: false,
          saveAsImage: false,
          export: false,
        },
        tools: {
          image: false,
        },
      }
    : UIOptions;

  return (
    <Excalidraw
      excalidrawAPI={excalidrawAPI}
      initialData={initialData}
      onChange={onChange}
      viewModeEnabled={viewModeEnabled}
      theme={theme}
      UIOptions={mobileUIOptions}
      zenModeEnabled={isMobile}
    >
      {/* Only render desktop hamburger menu when not on mobile */}
      {!isMobile &&
        React.useMemo(
          () => (
            <MainMenu>
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <HamburgerGridControls {...hamburgerProps} />
            </MainMenu>
          ),
          [hamburgerProps],
        )}
    </Excalidraw>
  );
});

export default ExcalidrawWrapper;
