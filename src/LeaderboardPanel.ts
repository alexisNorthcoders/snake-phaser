import Phaser from 'phaser';
import { FONT_FAMILY } from './font';
import { FramedPanel } from './FramedPanel';
import { PixelButton } from './PixelButton';
import {
  LEADERBOARD_PANEL,
  LEADERBOARD_REFRESH_BUTTON,
  LEADERBOARD_TAB_GAP,
  computeLeaderboardPanelLayout,
  globalRows,
  mineRows,
  type GlobalScoreEntry,
  type LeaderboardRow,
  type LeaderboardTab,
  type LocalScoreEntry,
} from './utils/leaderboardPanelLayout';

export interface LeaderboardPanelSources {
  fetchGlobal: () => Promise<GlobalScoreEntry[]>;
  loadMine: () => LocalScoreEntry[];
}

const TAB_LABELS: Record<LeaderboardTab, string> = { global: 'Global', mine: 'Mine' };
const TAB_SELECTED = '#ffff00';
const TAB_MUTED = '#777777';
const ROW_COLOR = '#aaaaaa';

/** Framed Global / Mine leaderboard; owns its objects and draws nothing once destroyed, even for a late fetch. */
export class LeaderboardPanel {
  private readonly frame: FramedPanel;
  private readonly layout = computeLeaderboardPanelLayout();
  private readonly tabTexts = new Map<LeaderboardTab, Phaser.GameObjects.Text>();
  private readonly refreshButton: PixelButton;
  private rowObjects: Phaser.GameObjects.Text[] = [];
  private tab: LeaderboardTab = 'global';
  private globalEntries?: GlobalScoreEntry[];
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly sources: LeaderboardPanelSources) {
    const p = LEADERBOARD_PANEL;
    const l = this.layout;
    this.frame = new FramedPanel(scene, p.x, p.y, p.width, p.height, p.scrimAlpha);

    let tabX = l.contentX;
    for (const tab of ['global', 'mine'] as const) {
      const text = scene.add
        .text(tabX, l.headerY + l.headerHeight / 2, TAB_LABELS[tab], {
          fontFamily: FONT_FAMILY, fontSize: '18px', color: TAB_MUTED,
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.select(tab));
      this.tabTexts.set(tab, text);
      tabX += text.width + LEADERBOARD_TAB_GAP;
    }

    const b = LEADERBOARD_REFRESH_BUTTON;
    this.refreshButton = new PixelButton(scene, {
      x: l.contentX + l.contentWidth - b.width,
      y: l.headerY + (l.headerHeight - b.height) / 2,
      width: b.width,
      height: b.height,
      label: 'Refresh',
      fontSize: 14,
      onClick: () => this.refresh(),
    });

    this.refresh();
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    this.frame.destroy();
    this.tabTexts.forEach((t) => t.destroy());
    this.tabTexts.clear();
    this.refreshButton.destroy();
    this.clearRows();
  }

  private select(tab: LeaderboardTab): void {
    if (this.destroyed || tab === this.tab) return;
    this.tab = tab;
    this.render();
  }

  private refresh(): void {
    this.sources
      .fetchGlobal()
      .catch(() => [] as GlobalScoreEntry[])
      .then((entries) => {
        if (this.destroyed) return;
        this.globalEntries = entries;
        this.render();
      });
  }

  private render(): void {
    this.tabTexts.forEach((text, tab) => text.setColor(tab === this.tab ? TAB_SELECTED : TAB_MUTED));
    this.clearRows();
    if (this.tab === 'global' && !this.globalEntries) {
      this.addRow(this.layout.nameX, this.layout.rowsY, 'Loading...', 0);
      return;
    }
    const rows = this.tab === 'global' ? globalRows(this.globalEntries!) : mineRows(this.sources.loadMine());
    if (rows.length === 0) {
      this.addRow(this.layout.nameX, this.layout.rowsY, 'No scores yet', 0);
      return;
    }
    rows.forEach((row, i) => this.drawRow(row, this.layout.rowsY + i * this.layout.rowHeight));
  }

  private drawRow(row: LeaderboardRow, y: number): void {
    const l = this.layout;
    this.addRow(l.rankX, y, row.rank, 0);
    this.addRow(l.nameX, y, row.label, 0);
    this.addRow(l.scoreRight, y, row.score, 1);
  }

  private addRow(x: number, y: number, content: string, originX: number): void {
    this.rowObjects.push(
      this.scene.add
        .text(x, y, content, { fontFamily: FONT_FAMILY, fontSize: '14px', color: ROW_COLOR })
        .setOrigin(originX, 0)
        .setScrollFactor(0),
    );
  }

  private clearRows(): void {
    this.rowObjects.forEach((o) => o.destroy());
    this.rowObjects = [];
  }
}
