export interface Box {
  /** Centre x. */
  x: number;
  /** Centre y. */
  y: number;
  width: number;
  height: number;
}

export interface AuthModalLayout {
  panel: Box;
  title: Box;
  subtitle: Box | null;
  usernameLabel: Box;
  usernameInput: Box;
  passwordLabel: Box;
  passwordInput: Box;
  error: Box;
  submit: Box;
  toggle: Box;
  back: Box;
  /** Width available to wrapped text inside the panel. */
  textWidth: number;
}

const MAX_PANEL_WIDTH = 360;
const CANVAS_MARGIN = 16;
const PADDING = 20;
const MAX_INPUT_WIDTH = 280;
const GAP = 8;

const TITLE_H = 30;
const SUBTITLE_H = 20;
const LABEL_H = 22;
const INPUT_H = 35;
const ERROR_H = 20;
const SUBMIT_H = 36;
const LINK_H = 20;

/** Pure layout for the auth overlay: canvas size in, centred panel and row boxes out. */
export function computeAuthModalLayout(canvasWidth: number, canvasHeight: number, hasSubtitle: boolean): AuthModalLayout {
  const panelWidth = Math.min(MAX_PANEL_WIDTH, canvasWidth - 2 * CANVAS_MARGIN);
  const textWidth = panelWidth - 2 * PADDING;
  const inputWidth = Math.min(MAX_INPUT_WIDTH, textWidth);
  const cx = canvasWidth / 2;

  const heights = [
    TITLE_H,
    ...(hasSubtitle ? [SUBTITLE_H] : []),
    LABEL_H, INPUT_H, LABEL_H, INPUT_H,
    ERROR_H, SUBMIT_H, LINK_H, LINK_H,
  ];
  const contentHeight = heights.reduce((a, b) => a + b, 0) + GAP * (heights.length - 1);
  const panelHeight = contentHeight + 2 * PADDING;
  const panelTop = canvasHeight / 2 - panelHeight / 2;

  let cursor = panelTop + PADDING;
  const row = (height: number, width = textWidth): Box => {
    const box = { x: cx, y: cursor + height / 2, width, height };
    cursor += height + GAP;
    return box;
  };

  const title = row(TITLE_H);
  const subtitle = hasSubtitle ? row(SUBTITLE_H) : null;
  const usernameLabel = row(LABEL_H);
  const usernameInput = row(INPUT_H, inputWidth);
  const passwordLabel = row(LABEL_H);
  const passwordInput = row(INPUT_H, inputWidth);
  const error = row(ERROR_H);
  const submit = row(SUBMIT_H, inputWidth);
  const toggle = row(LINK_H);
  const back = row(LINK_H);

  return {
    panel: { x: cx, y: canvasHeight / 2, width: panelWidth, height: panelHeight },
    title, subtitle, usernameLabel, usernameInput, passwordLabel, passwordInput, error, submit, toggle, back,
    textWidth,
  };
}
