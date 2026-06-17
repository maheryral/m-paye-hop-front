import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  SeatCellType,
  SeatInfo,
  SeatLayout,
  SeatPosition,
} from '../services/taxiBrousseApi';

interface Props {
  layout: SeatLayout | null;
  seatPositions: Record<number, SeatPosition> | null;
  seats: SeatInfo[];
  selectedSeats: number[];
  onSelectSeat: (numPlace: number) => void;
  /** Theme colors injectés par le parent. */
  colors: {
    text: string;
    textSecondary: string;
    background: string;
    card: string;
    border: string;
    primary?: string;
  };
}

const COUNTABLE = new Set<SeatCellType>([
  'seat',
  'window_seat',
  'vip_seat',
  'accessible_seat',
]);

const CELL_ICONS: Record<SeatCellType, keyof typeof Ionicons.glyphMap | null> = {
  seat: null,
  window_seat: null,
  vip_seat: 'star',
  accessible_seat: 'accessibility',
  aisle: 'walk-outline',
  door: 'log-out-outline',
  driver: 'person-circle-outline',
  wc: 'water-outline',
  empty: null,
};

const CELL_LABEL: Record<SeatCellType, string> = {
  seat: 'Siège',
  window_seat: 'Fenêtre',
  vip_seat: 'VIP',
  accessible_seat: 'PMR',
  aisle: 'Couloir',
  door: 'Porte',
  driver: 'Chauffeur',
  wc: 'WC',
  empty: '',
};

export default function SeatPlanView({
  layout,
  seatPositions,
  seats,
  selectedSeats,
  onSelectSeat,
  colors,
}: Props) {
  // Fallback : grille générique si pas de layout custom
  if (!layout || !seatPositions) {
    return (
      <FallbackGrid
        seats={seats}
        selectedSeats={selectedSeats}
        onSelectSeat={onSelectSeat}
        colors={colors}
      />
    );
  }

  // Index pour récupérer rapidement le numéro de place à partir des coords
  const coordToSeat = new Map<string, number>();
  Object.entries(seatPositions).forEach(([numStr, pos]) => {
    coordToSeat.set(`${pos.deck}-${pos.row}-${pos.col}`, Number(numStr));
  });

  const seatByNum = new Map<number, SeatInfo>();
  seats.forEach((s) => seatByNum.set(s.numPlace, s));

  return (
    <View>
      {[...layout.decks]
        .sort((a, b) => a.deckNumber - b.deckNumber)
        .map((deck) => (
          <View key={deck.deckNumber} style={styles.deckBlock}>
            <Text style={[styles.deckTitle, { color: colors.textSecondary }]}>
              {deck.name ?? `Étage ${deck.deckNumber}`}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.deckScroll}
            >
              <View>
                {deck.grid.map((row, rIdx) => (
                  <View key={rIdx} style={styles.row}>
                    {row.map((cellType, cIdx) => {
                      const numPlace = coordToSeat.get(
                        `${deck.deckNumber}-${rIdx}-${cIdx}`,
                      );
                      const seat = numPlace ? seatByNum.get(numPlace) : undefined;
                      return (
                        <Cell
                          key={`${rIdx}-${cIdx}`}
                          type={cellType}
                          numPlace={numPlace}
                          seat={seat}
                          isSelected={
                            numPlace != null && selectedSeats.includes(numPlace)
                          }
                          onSelect={onSelectSeat}
                          colors={colors}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        ))}

      <Legend colors={colors} />
    </View>
  );
}

function Cell({
  type,
  numPlace,
  seat,
  isSelected,
  onSelect,
  colors,
}: {
  type: SeatCellType;
  numPlace?: number;
  seat?: SeatInfo;
  isSelected: boolean;
  onSelect: (n: number) => void;
  colors: Props['colors'];
}) {
  const countable = COUNTABLE.has(type);
  const icon = CELL_ICONS[type];

  // Cellule non interactive (décor)
  if (!countable || !numPlace) {
    const bg = decorBg(type);
    return (
      <View
        style={[
          styles.cell,
          { backgroundColor: bg, borderColor: bg === 'transparent' ? 'transparent' : '#0002' },
        ]}
      >
        {icon && <Ionicons name={icon} size={14} color={colors.textSecondary} />}
      </View>
    );
  }

  // Siège
  const reserved = !!seat?.isReserved;
  const paid = !!seat?.isPaid;
  let bg: string;
  let textColor: string;

  if (reserved) {
    bg = paid ? '#10b981' : '#f59e0b';
    textColor = '#fff';
  } else if (isSelected) {
    bg = '#1e40af';
    textColor = '#fff';
  } else {
    bg = colors.background;
    textColor = colors.text;
  }

  return (
    <TouchableOpacity
      onPress={() => !reserved && onSelect(numPlace)}
      disabled={reserved}
      activeOpacity={0.7}
      style={[
        styles.cell,
        styles.seatCell,
        { backgroundColor: bg, borderColor: reserved || isSelected ? bg : '#1e40af' },
      ]}
    >
      {type === 'window_seat' && (
        <View style={styles.windowDot} />
      )}
      {type === 'vip_seat' && (
        <Ionicons name="star" size={9} color={textColor} style={styles.cornerIcon} />
      )}
      {type === 'accessible_seat' && (
        <Ionicons name="accessibility" size={9} color={textColor} style={styles.cornerIcon} />
      )}
      <Text style={[styles.seatNum, { color: textColor }]}>{numPlace}</Text>
    </TouchableOpacity>
  );
}

function decorBg(type: SeatCellType): string {
  switch (type) {
    case 'driver':
      return '#fecaca';
    case 'door':
      return '#fde68a';
    case 'wc':
      return '#a5f3fc';
    case 'aisle':
      return 'transparent';
    case 'empty':
    default:
      return 'transparent';
  }
}

function FallbackGrid({
  seats,
  selectedSeats,
  onSelectSeat,
  colors,
}: {
  seats: SeatInfo[];
  selectedSeats: number[];
  onSelectSeat: (n: number) => void;
  colors: Props['colors'];
}) {
  return (
    <View>
      <View style={styles.driverIndicator}>
        <Ionicons name="person-circle-outline" size={20} color={colors.textSecondary} />
        <Text style={[styles.driverText, { color: colors.textSecondary }]}>Chauffeur</Text>
      </View>
      <View style={styles.fallbackGrid}>
        {seats.map((seat) => {
          const reserved = seat.isReserved;
          const selected = selectedSeats.includes(seat.numPlace);
          let bg: string;
          let txt: string;
          if (reserved) {
            bg = seat.isPaid ? '#10b981' : '#f59e0b';
            txt = '#fff';
          } else if (selected) {
            bg = '#1e40af';
            txt = '#fff';
          } else {
            bg = colors.background;
            txt = colors.text;
          }
          return (
            <TouchableOpacity
              key={seat.numPlace}
              onPress={() => !reserved && onSelectSeat(seat.numPlace)}
              disabled={reserved}
              activeOpacity={0.7}
              style={[
                styles.cell,
                styles.seatCell,
                { backgroundColor: bg, borderColor: reserved || selected ? bg : '#1e40af' },
              ]}
            >
              <Text style={[styles.seatNum, { color: txt }]}>{seat.numPlace}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Legend colors={colors} />
    </View>
  );
}

function Legend({ colors }: { colors: Props['colors'] }) {
  return (
    <View style={styles.legend}>
      <LegendItem color={colors.background} border="#1e40af" label="Libre" colors={colors} />
      <LegendItem color="#1e40af" label="Sélectionné" colors={colors} />
      <LegendItem color="#f59e0b" label="Réservé (impayé)" colors={colors} />
      <LegendItem color="#10b981" label="Payé" colors={colors} />
    </View>
  );
}

function LegendItem({
  color,
  border,
  label,
  colors,
}: {
  color: string;
  border?: string;
  label: string;
  colors: Props['colors'];
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          {
            backgroundColor: color,
            borderColor: border ?? color,
            borderWidth: border ? 1 : 0,
          },
        ]}
      />
      <Text style={[styles.legendText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const CELL_SIZE = 40;
const styles = StyleSheet.create({
  deckBlock: {
    marginBottom: 16,
  },
  deckTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  deckScroll: {
    paddingVertical: 8,
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    marginRight: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  seatCell: {
    borderRadius: 10,
  },
  seatNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  windowDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#22d3ee',
  },
  cornerIcon: {
    position: 'absolute',
    top: 3,
    right: 3,
  },
  driverIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  driverText: {
    fontSize: 12,
  },
  fallbackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#0002',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
});
