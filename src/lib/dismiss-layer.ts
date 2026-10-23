type DismissLayerHandler = () => boolean | void;

const handlers: Array<{ id: symbol; handler: DismissLayerHandler }> = [];

function dismissTopLayer() {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    const entry = handlers[index];
    if (!entry) continue;
    if (entry.handler() !== false) return true;
  }
  return false;
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (!dismissTopLayer()) return;
  event.preventDefault();
  event.stopPropagation();
}

function attachListeners() {
  if (handlers.length !== 1) return;
  window.addEventListener('keydown', handleEscape);
}

function detachListeners() {
  if (handlers.length !== 0) return;
  window.removeEventListener('keydown', handleEscape);
}

export function registerDismissLayer(handler: DismissLayerHandler) {
  const id = Symbol('dismiss-layer');
  handlers.push({ id, handler });
  attachListeners();

  return () => {
    const index = handlers.findIndex((entry) => entry.id === id);
    if (index >= 0) handlers.splice(index, 1);
    detachListeners();
  };
}
