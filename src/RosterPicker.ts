import Phaser from 'phaser';
import { FONT_FAMILY } from './font';
import { FramedPanel } from './FramedPanel';
import { PixelButton } from './PixelButton';
import type { GameMode } from './gameMode';
import { methodLabel, personalityLabel, recordLines, ROOKIE, type BotRecords, type RosterEntry } from './roster';
import { ROSTER_CARD, ROSTER_PICKER, computeRosterPickerLayout, type RosterPickerLayout } from './utils/rosterPickerLayout';

/** Above the lobby, its panels and the header, so nothing under the picker shows through or takes a click. */
const PICKER_DEPTH = 50;
const TITLE_COLOR = '#ffffff';
const TITLE_SHADOW = '#008000';
const DETAIL_COLOR = '#cccccc';
const BASELINE_COLOR = '#ffff00';

export interface RosterPickerOptions {
  /** Resolves to the snakes to show; the picker says it's loading until then. */
  roster: Promise<RosterEntry[]>;
  /** Resolves to each snake's record against humans; cards show none until it does, or if it never loads. */
  records: Promise<BotRecords>;
  /** The mode the player has chosen, whose record is shown first. */
  mode: GameMode;
  /** The id chosen last time, whose card is highlighted. */
  chosenId: string;
  onChoose: (entry: RosterEntry) => void;
  onClose: () => void;
}

/**
 * "Play vs Computer"'s roster picker: one card per snake over the lobby panel, and a close button back to the lobby.
 * Swallows every click outside it while open; owns its objects and draws nothing once destroyed, even for a late roster.
 */
export class RosterPicker {
  private readonly objects: { destroy(): void }[] = [];
  private frame?: FramedPanel;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly options: RosterPickerOptions) {
    // Catches clicks anywhere on the canvas, so the lobby under the picker can't be used while it's open.
    const blocker = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(PICKER_DEPTH)
      .setInteractive();
    this.objects.push(blocker);
    const l = computeRosterPickerLayout(1);
    this.drawFrame(l);
    this.text(l.panel.x + ROSTER_PICKER.padding, l.titleY + ROSTER_PICKER.closeSize / 2, 'Choose your opponent', 28, TITLE_COLOR)
      .setOrigin(0, 0.5)
      .setShadow(4, 4, TITLE_SHADOW, 0, false, true);
    this.objects.push(new PixelButton(scene, {
      x: l.closeX,
      y: l.closeY,
      width: ROSTER_PICKER.closeSize,
      height: ROSTER_PICKER.closeSize,
      label: 'X',
      fontSize: 20,
      onClick: () => options.onClose(),
    }).setDepth(PICKER_DEPTH + 1));
    const loading = this.text(l.panel.x + l.panel.width / 2, l.cardsY + ROSTER_CARD.height / 2, 'Loading...', 20, DETAIL_COLOR)
      .setOrigin(0.5);
    options.roster.then((entries) => {
      if (this.destroyed) return;
      loading.destroy();
      const layout = computeRosterPickerLayout(entries.length);
      this.drawFrame(layout);
      this.drawCards(entries, layout);
      // Independent of the roster: the cards are already up, and a failed load leaves the record lines empty.
      options.records.then((records) => this.drawRecords(entries, layout, records), () => {});
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.frame?.destroy();
    this.frame = undefined;
    this.objects.forEach((obj) => obj.destroy());
    this.objects.length = 0;
  }

  /** The frame and divider, sized by `l`; redrawn once the roster is in, under the title and cards. */
  private drawFrame(l: RosterPickerLayout): void {
    this.frame?.destroy();
    this.frame = new FramedPanel(this.scene, l.panel.x, l.panel.y, l.panel.width, l.panel.height, ROSTER_PICKER.scrimAlpha);
    this.frame.addDivider(l.panel.x + ROSTER_PICKER.padding, l.dividerY, l.panel.width - 2 * ROSTER_PICKER.padding);
    this.frame.setDepth(PICKER_DEPTH);
  }

  private drawCards(entries: RosterEntry[], l: RosterPickerLayout): void {
    entries.forEach((entry, i) => {
      const { x, y } = l.cards[i];
      const card = new PixelButton(this.scene, {
        x,
        y,
        width: ROSTER_CARD.width,
        height: ROSTER_CARD.height,
        label: '',
        fill: entry.id === this.options.chosenId ? 'button-alt' : 'button',
        onClick: () => this.options.onChoose(entry),
      }).setDepth(PICKER_DEPTH + 1);
      this.objects.push(card);
      const left = x + ROSTER_CARD.padding;
      const lineY = (line: number) => y + ROSTER_CARD.padding + ROSTER_CARD.lineHeight * line + ROSTER_CARD.lineHeight / 2;
      this.text(left, lineY(0), entry.name, 22, TITLE_COLOR).setOrigin(0, 0.5);
      if (entry.id === ROOKIE.id) {
        this.text(x + ROSTER_CARD.width - ROSTER_CARD.padding, lineY(0), 'Baseline', 16, BASELINE_COLOR).setOrigin(1, 0.5);
      }
      let line = 1;
      if (entry.personality !== undefined) {
        this.text(left, lineY(line++), personalityLabel(entry.personality), 16, DETAIL_COLOR).setOrigin(0, 0.5);
      }
      this.text(left, lineY(line), `Gen ${entry.generation} · ${methodLabel(entry.method)}`, 16, DETAIL_COLOR).setOrigin(0, 0.5);
    });
  }

  /** Each card's record against humans on line `ROSTER_CARD.recordLine`, a mode per row, chosen mode first. */
  private drawRecords(entries: RosterEntry[], l: RosterPickerLayout, records: BotRecords): void {
    if (this.destroyed) return;
    entries.forEach((entry, i) => {
      const { x, y } = l.cards[i];
      const lines = recordLines(records, entry.id, this.options.mode);
      const centerY = y + ROSTER_CARD.padding + ROSTER_CARD.lineHeight * ROSTER_CARD.recordLine + ROSTER_CARD.lineHeight / 2;
      this.text(x + ROSTER_CARD.padding, centerY, lines.join('\n'), 13, DETAIL_COLOR).setOrigin(0, 0.5);
    });
  }

  private text(x: number, y: number, content: string, size: number, color: string): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, content, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color })
      .setScrollFactor(0)
      .setDepth(PICKER_DEPTH + 2);
    this.objects.push(text);
    return text;
  }
}
