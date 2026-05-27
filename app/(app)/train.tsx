import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

// Types
interface Station {
  id: string;
  name: string;
  city: string;
  code: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

interface Train {
  id: string;
  name: string;
  number: string;
  type: 'EXPRESS' | 'REGIONAL' | 'NIGHT' | 'LUXURY';
  fromStation: Station;
  toStation: Station;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  availableSeats: number;
  amenities: string[];
  image: string;
}

interface Carriage {
  id: string;
  trainId: string;
  type: 'FIRST_CLASS' | 'SECOND_CLASS' | 'SLEEPER' | 'DINING';
  number: string;
  capacity: number;
  availableSeats: number;
  price: number;
  amenities: string[];
}

interface Seat {
  id: string;
  carriageId: string;
  number: string;
  type: 'WINDOW' | 'AISLE' | 'MIDDLE';
  isAvailable: boolean;
  price: number;
}

interface Booking {
  id: string;
  train: Train;
  carriage: Carriage;
  seat: Seat;
  departureStation: Station;
  arrivalStation: Station;
  departureDate: Date;
  arrivalDate: Date;
  passengers: Passenger[];
  totalPrice: number;
  bookingReference: string;
  qrCode: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}

interface Passenger {
  id: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE';
  idCardNumber: string;
  seatNumber?: string;
}

export default function TrainBooking() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [stations, setStations] = useState<Station[]>([]);
  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [carriages, setCarriages] = useState<Carriage[]>([]);
  const [selectedCarriage, setSelectedCarriage] = useState<Carriage | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [departureDate, setDepartureDate] = useState<Date>(new Date());
  const [returnDate, setReturnDate] = useState<Date>(new Date(Date.now() + 86400000));
  const [passengers, setPassengers] = useState<Passenger[]>([
    { id: '1', name: '', age: 0, gender: 'MALE', idCardNumber: '' }
  ]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [stationType, setStationType] = useState<'from' | 'to'>('from');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [isRoundTrip, setIsRoundTrip] = useState(false);

  // Stations données
  const stationsData: Station[] = [
    { id: '1', name: 'Gare d\'Antananarivo', city: 'Antananarivo', code: 'TNR', coordinates: { latitude: -18.8792, longitude: 47.5079 } },
    { id: '2', name: 'Gare d\'Antsirabe', city: 'Antsirabe', code: 'ATS', coordinates: { latitude: -19.8668, longitude: 47.0333 } },
    { id: '3', name: 'Gare de Fianarantsoa', city: 'Fianarantsoa', code: 'FIA', coordinates: { latitude: -21.4544, longitude: 47.0856 } },
    { id: '4', name: 'Gare de Toamasina', city: 'Toamasina', code: 'TMS', coordinates: { latitude: -18.1445, longitude: 49.3958 } },
    { id: '5', name: 'Gare de Mahajanga', city: 'Mahajanga', code: 'MJN', coordinates: { latitude: -15.7167, longitude: 46.3167 } },
    { id: '6', name: 'Gare de Morondava', city: 'Morondava', code: 'MOQ', coordinates: { latitude: -20.2875, longitude: 44.3175 } },
  ];

  // Trains données
  const trainsData: Train[] = [
    {
      id: '1',
      name: 'Express d\'Or',
      number: 'EX-101',
      type: 'EXPRESS',
      fromStation: stationsData[0],
      toStation: stationsData[1],
      departureTime: '07:00',
      arrivalTime: '10:30',
      duration: '3h30',
      price: 45000,
      availableSeats: 45,
      amenities: ['Climatisation', 'WiFi', 'Restauration', 'Prises USB'],
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    },
    {
      id: '2',
      name: 'Train Bleu',
      number: 'TB-202',
      type: 'LUXURY',
      fromStation: stationsData[0],
      toStation: stationsData[2],
      departureTime: '08:30',
      arrivalTime: '15:00',
      duration: '6h30',
      price: 120000,
      availableSeats: 28,
      amenities: ['Climatisation', 'WiFi', 'Restauration', 'Prises USB', 'TV', 'Bar', 'Douche'],
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    },
    {
      id: '3',
      name: 'Régional Express',
      number: 'RE-303',
      type: 'REGIONAL',
      fromStation: stationsData[1],
      toStation: stationsData[2],
      departureTime: '06:15',
      arrivalTime: '11:45',
      duration: '5h30',
      price: 35000,
      availableSeats: 60,
      amenities: ['Climatisation', 'WiFi'],
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    },
    {
      id: '4',
      name: 'Train de Nuit',
      number: 'NT-404',
      type: 'NIGHT',
      fromStation: stationsData[0],
      toStation: stationsData[3],
      departureTime: '20:00',
      arrivalTime: '06:30',
      duration: '10h30',
      price: 85000,
      availableSeats: 32,
      amenities: ['Lit', 'Climatisation', 'Restauration', 'Douche', 'Cabine privée'],
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    },
    {
      id: '5',
      name: 'Train de la Côte',
      number: 'TC-505',
      type: 'EXPRESS',
      fromStation: stationsData[0],
      toStation: stationsData[4],
      departureTime: '09:00',
      arrivalTime: '16:00',
      duration: '7h',
      price: 55000,
      availableSeats: 50,
      amenities: ['Climatisation', 'WiFi', 'Restauration'],
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    },
    {
      id: '6',
      name: 'Train du Sud',
      number: 'TS-606',
      type: 'REGIONAL',
      fromStation: stationsData[2],
      toStation: stationsData[5],
      departureTime: '07:30',
      arrivalTime: '14:30',
      duration: '7h',
      price: 40000,
      availableSeats: 55,
      amenities: ['Climatisation'],
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    },
  ];

  useEffect(() => {
    setStations(stationsData);
  }, []);

  const handleStationSelect = (station: Station) => {
    if (stationType === 'from') {
      setFromStation(station);
      if (toStation && toStation.id === station.id) {
        setToStation(null);
      }
    } else {
      setToStation(station);
      if (fromStation && fromStation.id === station.id) {
        setFromStation(null);
      }
    }
    setShowStationModal(false);
  };

  const searchTrains = () => {
    if (!fromStation || !toStation) {
      Alert.alert('Erreur', 'Veuillez sélectionner les gares de départ et d\'arrivée');
      return;
    }

    const availableTrains = trainsData.filter(train => 
      train.fromStation.id === fromStation.id && 
      train.toStation.id === toStation.id
    );
    
    setTrains(availableTrains);
    if (availableTrains.length > 0) {
      setStep(2);
    } else {
      Alert.alert('Information', 'Aucun train trouvé pour ce trajet');
    }
  };

  const handleTrainSelect = (train: Train) => {
    setSelectedTrain(train);
    // Générer les voitures pour ce train
    const carriagesData: Carriage[] = [
      {
        id: `${train.id}_1`,
        trainId: train.id,
        type: train.type === 'LUXURY' ? 'FIRST_CLASS' : train.type === 'NIGHT' ? 'SLEEPER' : 'SECOND_CLASS',
        number: 'A',
        capacity: 32,
        availableSeats: Math.floor(Math.random() * 20) + 10,
        price: train.price,
        amenities: train.amenities,
      },
      {
        id: `${train.id}_2`,
        trainId: train.id,
        type: train.type === 'LUXURY' ? 'FIRST_CLASS' : 'SECOND_CLASS',
        number: 'B',
        capacity: 40,
        availableSeats: Math.floor(Math.random() * 25) + 15,
        price: train.price * 0.7,
        amenities: ['Climatisation', 'WiFi'],
      },
    ];
    
    if (train.type === 'LUXURY') {
      carriagesData.push({
        id: `${train.id}_3`,
        trainId: train.id,
        type: 'DINING',
        number: 'C',
        capacity: 20,
        availableSeats: 20,
        price: 0,
        amenities: ['Restaurant', 'Bar'],
      });
    }
    
    setCarriages(carriagesData);
    setStep(3);
  };

  const handleCarriageSelect = (carriage: Carriage) => {
    setSelectedCarriage(carriage);
    // Générer les sièges pour cette voiture
    const seatsData: Seat[] = [];
    const seatTypes: ('WINDOW' | 'AISLE' | 'MIDDLE')[] = ['WINDOW', 'AISLE', 'MIDDLE'];
    
    for (let i = 1; i <= carriage.capacity; i++) {
      seatsData.push({
        id: `${carriage.id}_seat_${i}`,
        carriageId: carriage.id,
        number: i.toString(),
        type: seatTypes[i % 3],
        isAvailable: i <= carriage.availableSeats,
        price: carriage.price,
      });
    }
    
    setSeats(seatsData);
    setStep(4);
  };

  const handleSeatSelect = (seat: Seat) => {
    if (!seat.isAvailable) {
      Alert.alert('Indisponible', 'Ce siège n\'est pas disponible');
      return;
    }
    setSelectedSeat(seat);
    setStep(5);
  };

  const addPassenger = () => {
    setEditingPassenger(null);
    setShowPassengerModal(true);
  };

  const editPassenger = (passenger: Passenger) => {
    setEditingPassenger(passenger);
    setShowPassengerModal(true);
  };

  const removePassenger = (id: string) => {
    setPassengers(passengers.filter(p => p.id !== id));
  };

  const savePassenger = (passengerData: Omit<Passenger, 'id'>) => {
    if (editingPassenger) {
      setPassengers(passengers.map(p => 
        p.id === editingPassenger.id ? { ...passengerData, id: p.id } : p
      ));
    } else {
      setPassengers([...passengers, { ...passengerData, id: Date.now().toString() }]);
    }
    setShowPassengerModal(false);
  };

  const calculateTotalPrice = () => {
    if (!selectedTrain || !selectedCarriage || !selectedSeat) return 0;
    const passengerCount = passengers.length;
    return selectedSeat.price * passengerCount;
  };

  const handleBooking = async () => {
    if (!selectedTrain || !selectedCarriage || !selectedSeat || !fromStation || !toStation) return;
    
    if (passengers.some(p => !p.name || !p.age || !p.idCardNumber)) {
      Alert.alert('Erreur', 'Veuillez remplir toutes les informations des passagers');
      return;
    }

    setLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newBooking: Booking = {
        id: Math.random().toString(36).substr(2, 9),
        train: selectedTrain,
        carriage: selectedCarriage,
        seat: selectedSeat,
        departureStation: fromStation,
        arrivalStation: toStation,
        departureDate: departureDate,
        arrivalDate: new Date(departureDate.getTime() + (parseInt(selectedTrain.duration) * 3600000)),
        passengers: passengers,
        totalPrice: calculateTotalPrice(),
        bookingReference: `TR${Math.floor(Math.random() * 1000000)}`,
        qrCode: `TRN-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        status: 'CONFIRMED',
      };
      
      setBooking(newBooking);
      setShowPaymentModal(false);
      setShowTicketModal(true);
    } catch (error) {
      Alert.alert('Erreur', 'La réservation a échoué');
    } finally {
      setLoading(false);
    }
  };

  const getTrainTypeIcon = (type: string) => {
    switch(type) {
      case 'EXPRESS': return 'flash-outline';
      case 'LUXURY': return 'diamond-outline';
      case 'NIGHT': return 'moon-outline';
      default: return 'train-outline';
    }
  };

  const getTrainTypeColor = (type: string) => {
    switch(type) {
      case 'EXPRESS': return '#3b82f6';
      case 'LUXURY': return '#8b5cf6';
      case 'NIGHT': return '#3b82f6';
      default: return '#f59e0b';
    }
  };

  const getCarriageTypeName = (type: string) => {
    switch(type) {
      case 'FIRST_CLASS': return 'Première Classe';
      case 'SECOND_CLASS': return 'Seconde Classe';
      case 'SLEEPER': return 'Couchette';
      case 'DINING': return 'Wagon Restaurant';
      default: return 'Standard';
    }
  };

  const StationSelector = ({ label, station, onPress }: { label: string; station: Station | null; onPress: () => void }) => (
    <TouchableOpacity style={[styles.stationSelector, { borderColor: colors.border }]} onPress={onPress}>
      <Ionicons name="location-outline" size={24} color={colors.primary} />
      <View style={styles.stationSelectorContent}>
        <Text style={[styles.stationSelectorLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.stationSelectorValue, { color: colors.text }]}>
          {station ? `${station.name} (${station.code})` : 'Sélectionner'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const TrainCard = ({ train }: { train: Train }) => (
    <TouchableOpacity
      style={[styles.trainCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleTrainSelect(train)}
    >
      <View style={styles.trainHeader}>
        <View style={[styles.trainTypeBadge, { backgroundColor: `${getTrainTypeColor(train.type)}20` }]}>
          <Ionicons name={getTrainTypeIcon(train.type)} size={14} color={getTrainTypeColor(train.type)} />
          <Text style={[styles.trainTypeText, { color: getTrainTypeColor(train.type) }]}>
            {train.type}
          </Text>
        </View>
        <Text style={[styles.trainNumber, { color: colors.textSecondary }]}>Train {train.number}</Text>
      </View>

      <Text style={[styles.trainName, { color: colors.text }]}>{train.name}</Text>

      <View style={styles.trainSchedule}>
        <View style={styles.schedulePoint}>
          <Text style={[styles.scheduleTime, { color: colors.text }]}>{train.departureTime}</Text>
          <Text style={[styles.stationCode, { color: colors.textSecondary }]}>{train.fromStation.code}</Text>
        </View>
        
        <View style={styles.scheduleLine}>
          <View style={styles.line} />
          <Ionicons name="train-outline" size={16} color={colors.primary} />
          <Text style={[styles.duration, { color: colors.textSecondary }]}>{train.duration}</Text>
          <View style={styles.line} />
        </View>
        
        <View style={styles.schedulePoint}>
          <Text style={[styles.scheduleTime, { color: colors.text }]}>{train.arrivalTime}</Text>
          <Text style={[styles.stationCode, { color: colors.textSecondary }]}>{train.toStation.code}</Text>
        </View>
      </View>

      <View style={styles.trainFooter}>
        <View style={styles.amenities}>
          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
          <Text style={[styles.amenitiesText, { color: colors.textSecondary }]}>
            {train.amenities.slice(0, 3).join(' · ')}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: colors.primary }]}>
            {train.price.toLocaleString()} Ar
          </Text>
          <Text style={[styles.priceUnit, { color: colors.textSecondary }]}>/pers</Text>
        </View>
      </View>

      <View style={[styles.availabilityBadge, { backgroundColor: train.availableSeats > 20 ? '#3b82f620' : '#f59e0b20' }]}>
        <Text style={[styles.availabilityText, { color: train.availableSeats > 20 ? '#3b82f6' : '#f59e0b' }]}>
          {train.availableSeats} places disponibles
        </Text>
      </View>
    </TouchableOpacity>
  );

  const CarriageCard = ({ carriage }: { carriage: Carriage }) => (
    <TouchableOpacity
      style={[
        styles.carriageCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        selectedCarriage?.id === carriage.id && { borderColor: colors.primary, borderWidth: 2 }
      ]}
      onPress={() => handleCarriageSelect(carriage)}
    >
      <View style={styles.carriageHeader}>
        <Text style={[styles.carriageNumber, { color: colors.text }]}>Wagon {carriage.number}</Text>
        <View style={[styles.carriageTypeBadge, { backgroundColor: `${colors.primary}20` }]}>
          <Text style={[styles.carriageTypeText, { color: colors.primary }]}>
            {getCarriageTypeName(carriage.type)}
          </Text>
        </View>
      </View>

      <View style={styles.carriageDetails}>
        <View style={styles.carriageDetail}>
          <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.carriageDetailText, { color: colors.textSecondary }]}>
            {carriage.availableSeats} / {carriage.capacity} places
          </Text>
        </View>
        <View style={styles.carriageDetail}>
          <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.carriageDetailText, { color: colors.primary }]}>
            {carriage.price.toLocaleString()} Ar
          </Text>
        </View>
      </View>

      <View style={styles.carriageAmenities}>
        {carriage.amenities.slice(0, 3).map((amenity, index) => (
          <View key={index} style={styles.carriageAmenity}>
            <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
            <Text style={[styles.carriageAmenityText, { color: colors.textSecondary }]}>{amenity}</Text>
          </View>
        ))}
      </View>

      {selectedCarriage?.id === carriage.id && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );

  const SeatMap = () => (
    <View style={styles.seatMap}>
      <View style={styles.seatLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Disponible</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Sélectionné</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#ef444420', borderWidth: 1, borderColor: '#ef4444' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Occupé</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#8b5cf620', borderWidth: 1, borderColor: '#8b5cf6' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Fenêtre</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#3b82f620', borderWidth: 1, borderColor: '#3b82f6' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Couloir</Text>
        </View>
      </View>

      <View style={styles.seatsGrid}>
        {Array.from({ length: Math.ceil(seats.length / 4) }, (_, row) => (
          <View key={row} style={styles.seatRow}>
            {seats.slice(row * 4, row * 4 + 4).map((seat) => (
              <TouchableOpacity
                key={seat.id}
                style={[
                  styles.seat,
                  !seat.isAvailable && styles.seatUnavailable,
                  selectedSeat?.id === seat.id && styles.seatSelected,
                  { 
                    backgroundColor: !seat.isAvailable ? '#ef444420' : 
                      (selectedSeat?.id === seat.id ? colors.primary : colors.card),
                    borderColor: seat.type === 'WINDOW' ? '#8b5cf6' : 
                      (seat.type === 'AISLE' ? '#3b82f6' : colors.border)
                  }
                ]}
                onPress={() => handleSeatSelect(seat)}
                disabled={!seat.isAvailable}
              >
                <Text style={[
                  styles.seatNumber,
                  { color: !seat.isAvailable ? '#ef4444' : 
                    (selectedSeat?.id === seat.id ? '#fff' : colors.text) }
                ]}>
                  {seat.number}
                </Text>
                {seat.type === 'WINDOW' && (
                  <Ionicons name="eye-outline" size={12} color={!seat.isAvailable ? '#ef4444' : (selectedSeat?.id === seat.id ? '#fff' : '#8b5cf6')} />
                )}
                {seat.type === 'AISLE' && (
                  <Ionicons name="walk-outline" size={12} color={!seat.isAvailable ? '#ef4444' : (selectedSeat?.id === seat.id ? '#fff' : '#3b82f6')} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  const PassengerForm = () => (
    <Modal
      visible={showPassengerModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.passengerModal, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingPassenger ? 'Modifier passager' : 'Ajouter passager'}
            </Text>
            <TouchableOpacity onPress={() => setShowPassengerModal(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.passengerInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Nom complet"
            placeholderTextColor={colors.textSecondary}
            defaultValue={editingPassenger?.name}
            onChangeText={(text) => editingPassenger && setEditingPassenger({ ...editingPassenger, name: text })}
          />

          <TextInput
            style={[styles.passengerInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Âge"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            defaultValue={editingPassenger?.age.toString()}
            onChangeText={(text) => editingPassenger && setEditingPassenger({ ...editingPassenger, age: parseInt(text) || 0 })}
          />

          <View style={styles.genderSelector}>
            <TouchableOpacity
              style={[
                styles.genderOption,
                editingPassenger?.gender === 'MALE' && styles.genderOptionActive,
                { borderColor: colors.border }
              ]}
              onPress={() => editingPassenger && setEditingPassenger({ ...editingPassenger, gender: 'MALE' })}
            >
              <Ionicons name="male-outline" size={20} color={editingPassenger?.gender === 'MALE' ? '#fff' : colors.text} />
              <Text style={[styles.genderText, { color: editingPassenger?.gender === 'MALE' ? '#fff' : colors.text }]}>
                Homme
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.genderOption,
                editingPassenger?.gender === 'FEMALE' && styles.genderOptionActive,
                { borderColor: colors.border }
              ]}
              onPress={() => editingPassenger && setEditingPassenger({ ...editingPassenger, gender: 'FEMALE' })}
            >
              <Ionicons name="female-outline" size={20} color={editingPassenger?.gender === 'FEMALE' ? '#fff' : colors.text} />
              <Text style={[styles.genderText, { color: editingPassenger?.gender === 'FEMALE' ? '#fff' : colors.text }]}>
                Femme
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.passengerInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Numéro CIN / Passeport"
            placeholderTextColor={colors.textSecondary}
            defaultValue={editingPassenger?.idCardNumber}
            onChangeText={(text) => editingPassenger && setEditingPassenger({ ...editingPassenger, idCardNumber: text })}
          />

          <TouchableOpacity
            style={[styles.savePassengerButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (editingPassenger) {
                savePassenger({
                  name: editingPassenger.name,
                  age: editingPassenger.age,
                  gender: editingPassenger.gender,
                  idCardNumber: editingPassenger.idCardNumber,
                });
              }
            }}
          >
            <Text style={styles.savePassengerButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const PassengerList = () => (
    <View>
      {passengers.map((passenger, index) => (
        <View key={passenger.id} style={[styles.passengerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.passengerHeader}>
            <View style={styles.passengerNumber}>
              <Text style={[styles.passengerNumberText, { color: colors.primary }]}>Passager {index + 1}</Text>
            </View>
            <View style={styles.passengerActions}>
              <TouchableOpacity onPress={() => editPassenger(passenger)}>
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              {passengers.length > 1 && (
                <TouchableOpacity onPress={() => removePassenger(passenger.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={[styles.passengerName, { color: colors.text }]}>{passenger.name}</Text>
          <Text style={[styles.passengerDetails, { color: colors.textSecondary }]}>
            {passenger.age} ans · {passenger.gender === 'MALE' ? 'Homme' : 'Femme'} · {passenger.idCardNumber}
          </Text>
        </View>
      ))}
      
      <TouchableOpacity style={[styles.addPassengerButton, { borderColor: colors.border }]} onPress={addPassenger}>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={[styles.addPassengerText, { color: colors.primary }]}>Ajouter un passager</Text>
      </TouchableOpacity>
    </View>
  );

  const BookingSummary = () => (
    <View>
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Trajet</Text>
        <View style={styles.tripSummary}>
          <View style={styles.tripPoint}>
            <Text style={[styles.tripStation, { color: colors.text }]}>{fromStation?.name}</Text>
            <Text style={[styles.tripTime, { color: colors.textSecondary }]}>{selectedTrain?.departureTime}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.primary} />
          <View style={styles.tripPoint}>
            <Text style={[styles.tripStation, { color: colors.text }]}>{toStation?.name}</Text>
            <Text style={[styles.tripTime, { color: colors.textSecondary }]}>{selectedTrain?.arrivalTime}</Text>
          </View>
        </View>
        <Text style={[styles.tripDuration, { color: colors.textSecondary }]}>Durée: {selectedTrain?.duration}</Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Train & Wagon</Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Train</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedTrain?.name} ({selectedTrain?.number})</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Wagon</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedCarriage?.number} - {getCarriageTypeName(selectedCarriage?.type || '')}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Siège</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>N° {selectedSeat?.number} ({selectedSeat?.type === 'WINDOW' ? 'Fenêtre' : selectedSeat?.type === 'AISLE' ? 'Couloir' : 'Milieu'})</Text>
        </View>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Date</Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Départ</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{departureDate.toLocaleDateString('fr-FR')}</Text>
        </View>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Passagers ({passengers.length})</Text>
        {passengers.map((passenger, index) => (
          <View key={passenger.id} style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Passager {index + 1}</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{passenger.name}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total à payer</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>
            {calculateTotalPrice().toLocaleString()} Ar
          </Text>
        </View>
        <Text style={[styles.totalNote, { color: colors.textSecondary }]}>
          *{passengers.length} billet(s) à {selectedSeat?.price.toLocaleString()} Ar
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.payButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowPaymentModal(true)}
      >
        <Ionicons name="card-outline" size={24} color="#fff" />
        <Text style={styles.payButtonText}>Payer maintenant</Text>
      </TouchableOpacity>
    </View>
  );

  const PaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.paymentModal, { backgroundColor: colors.card }]}>
          <Text style={[styles.paymentTitle, { color: colors.text }]}>Confirmation de paiement</Text>
          
          <View style={styles.paymentAmount}>
            <Text style={[styles.paymentAmountLabel, { color: colors.textSecondary }]}>Montant total</Text>
            <Text style={[styles.paymentAmountValue, { color: colors.primary }]}>
              {calculateTotalPrice().toLocaleString()} Ar
            </Text>
          </View>

          <View style={styles.paymentMethod}>
            <Ionicons name="wallet-outline" size={32} color={colors.primary} />
            <View>
              <Text style={[styles.paymentMethodTitle, { color: colors.text }]}>Portefeuille M'Paye</Text>
              <Text style={[styles.paymentMethodDesc, { color: colors.textSecondary }]}>
                Paiement sécurisé
              </Text>
            </View>
          </View>

          <View style={styles.paymentButtons}>
            <TouchableOpacity 
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setShowPaymentModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Annuler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleBooking}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirmer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const TicketModal = () => (
    <Modal
      visible={showTicketModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
          <View style={[styles.ticketCard, { backgroundColor: colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.ticketHeader}>
                <Ionicons name="train-outline" size={40} color={colors.primary} />
                <Text style={[styles.ticketTitle, { color: colors.text }]}>Billet de Train</Text>
                <TouchableOpacity onPress={() => {
                  setShowTicketModal(false);
                  router.push('/dashboard');
                }} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.ticketQR}>
                <View style={styles.qrCode}>
                  <Ionicons name="qr-code" size={150} color="#000" />
                </View>
                <Text style={[styles.reference, { color: colors.text }]}>
                  Réf: {booking?.bookingReference}
                </Text>
              </View>

              <View style={styles.ticketInfo}>
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Train</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text, fontWeight: 'bold' }]}>
                    {booking?.train.name} ({booking?.train.number})
                  </Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Type</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.train.type}</Text>
                </View>
                
                <View style={styles.ticketDivider} />
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Départ</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                    {booking?.departureStation.name} ({booking?.departureStation.code})
                  </Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Arrivée</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                    {booking?.arrivalStation.name} ({booking?.arrivalStation.code})
                  </Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Date</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                    {booking?.departureDate.toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Horaire</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                    {booking?.train.departureTime} → {booking?.train.arrivalTime}
                  </Text>
                </View>
                
                <View style={styles.ticketDivider} />
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Wagon</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                    {booking?.carriage.number} - {getCarriageTypeName(booking?.carriage.type || '')}
                  </Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Siège</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                    N° {booking?.seat.number} ({booking?.seat.type === 'WINDOW' ? 'Fenêtre' : booking?.seat.type === 'AISLE' ? 'Couloir' : 'Milieu'})
                  </Text>
                </View>
                
                <View style={styles.ticketDivider} />
                
                <Text style={[styles.ticketSubtitle, { color: colors.text }]}>Passagers</Text>
                {booking?.passengers.map((passenger, index) => (
                  <View key={passenger.id} style={styles.passengerRow}>
                    <Text style={[styles.passengerName, { color: colors.text }]}>{passenger.name}</Text>
                    <Text style={[styles.passengerDetails, { color: colors.textSecondary }]}>
                      {passenger.age} ans · {passenger.gender === 'MALE' ? 'H' : 'F'} · {passenger.idCardNumber}
                    </Text>
                  </View>
                ))}
                
                <View style={styles.ticketDivider} />
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary, fontSize: 16 }]}>Total</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.primary, fontSize: 20, fontWeight: 'bold' }]}>
                    {booking?.totalPrice.toLocaleString()} Ar
                  </Text>
                </View>
              </View>

              <View style={styles.ticketFooter}>
                <Text style={[styles.ticketNote, { color: colors.textSecondary }]}>
                  Présentez ce billet avec une pièce d'identité
                </Text>
                <TouchableOpacity 
                  style={[styles.downloadButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowTicketModal(false);
                    router.push('/dashboard');
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.downloadButtonText}>Terminer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </View>
    </Modal>
  );

  const StationModal = () => (
    <Modal
      visible={showStationModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.stationModal, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Sélectionner une gare
            </Text>
            <TouchableOpacity onPress={() => setShowStationModal(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Rechercher une gare..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <ScrollView style={styles.stationsList}>
            {stations
              .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.city.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((station) => (
                <TouchableOpacity
                  key={station.id}
                  style={[styles.stationItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleStationSelect(station)}
                >
                  <View>
                    <Text style={[styles.stationName, { color: colors.text }]}>{station.name}</Text>
                    <Text style={[styles.stationCity, { color: colors.textSecondary }]}>{station.city}</Text>
                  </View>
                  <Text style={[styles.stationCode, { color: colors.primary }]}>{station.code}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Train</Text>
          <View style={{ width: 40 }} />
        </View>

        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.tripTypeSelector}>
              <TouchableOpacity
                style={[styles.tripTypeButton, !isRoundTrip && styles.tripTypeActive]}
                onPress={() => setIsRoundTrip(false)}
              >
                <Text style={[styles.tripTypeText, !isRoundTrip && styles.tripTypeTextActive]}>
                  Aller simple
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tripTypeButton, isRoundTrip && styles.tripTypeActive]}
                onPress={() => setIsRoundTrip(true)}
              >
                <Text style={[styles.tripTypeText, isRoundTrip && styles.tripTypeTextActive]}>
                  Aller-retour
                </Text>
              </TouchableOpacity>
            </View>

            <StationSelector
              label="Gare de départ"
              station={fromStation}
              onPress={() => {
                setStationType('from');
                setShowStationModal(true);
              }}
            />

            <TouchableOpacity style={styles.swapButton} onPress={() => {
              const temp = fromStation;
              setFromStation(toStation);
              setToStation(temp);
            }}>
              <Ionicons name="swap-vertical" size={24} color={colors.primary} />
            </TouchableOpacity>

            <StationSelector
              label="Gare d'arrivée"
              station={toStation}
              onPress={() => {
                setStationType('to');
                setShowStationModal(true);
              }}
            />

            <TouchableOpacity
              style={[styles.dateSelector, { borderColor: colors.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              <View>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Date de départ</Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                  {departureDate.toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </TouchableOpacity>

            {isRoundTrip && (
              <TouchableOpacity
                style={[styles.dateSelector, { borderColor: colors.border }]}
                onPress={() => setShowReturnDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                <View>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Date de retour</Text>
                  <Text style={[styles.dateValue, { color: colors.text }]}>
                    {returnDate.toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={searchTrains}
            >
              <Ionicons name="search-outline" size={20} color="#fff" />
              <Text style={styles.searchButtonText}>Rechercher des trains</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Trains disponibles
              </Text>
            </View>

            <FlatList
              data={trains}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <TrainCard train={item} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.trainsList}
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep(2)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Choisissez un wagon
              </Text>
            </View>

            <View style={[styles.trainInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.trainInfoHeader}>
                <Ionicons name="train-outline" size={24} color={colors.primary} />
                <Text style={[styles.trainInfoName, { color: colors.text }]}>{selectedTrain?.name}</Text>
              </View>
              <Text style={[styles.trainInfoRoute, { color: colors.textSecondary }]}>
                {selectedTrain?.fromStation.code} → {selectedTrain?.toStation.code} · {selectedTrain?.departureTime} → {selectedTrain?.arrivalTime}
              </Text>
            </View>

            <FlatList
              data={carriages}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <CarriageCard carriage={item} />}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep(3)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Choisissez votre siège
              </Text>
            </View>

            <SeatMap />

            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: colors.primary }]}
              onPress={() => selectedSeat ? setStep(5) : Alert.alert('Erreur', 'Veuillez sélectionner un siège')}
            >
              <Text style={styles.continueButtonText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setStep(4)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Informations passagers
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <PassengerList />
              <BookingSummary />
            </ScrollView>
          </View>
        )}

        {showDatePicker && (
          <DateTimePicker
            value={departureDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) setDepartureDate(date);
            }}
            minimumDate={new Date()}
          />
        )}

        {showReturnDatePicker && (
          <DateTimePicker
            value={returnDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowReturnDatePicker(false);
              if (date && date > departureDate) setReturnDate(date);
            }}
            minimumDate={new Date(departureDate.getTime() + 86400000)}
          />
        )}

        <StationModal />
        <PassengerForm />
        <PaymentModal />
        <TicketModal />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerBack: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
  },
  tripTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tripTypeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tripTypeActive: {
    backgroundColor: '#3b82f6',
  },
  tripTypeText: {
    fontSize: 14,
    color: '#fff',
  },
  tripTypeTextActive: {
    fontWeight: 'bold',
  },
  stationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  stationSelectorContent: {
    flex: 1,
  },
  stationSelectorLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  stationSelectorValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  swapButton: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f620',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trainsList: {
    paddingBottom: 20,
  },
  trainCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  trainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trainTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  trainTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  trainNumber: {
    fontSize: 12,
  },
  trainName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  trainSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  schedulePoint: {
    alignItems: 'center',
  },
  scheduleTime: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stationCode: {
    fontSize: 11,
    marginTop: 2,
  },
  scheduleLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  duration: {
    fontSize: 11,
  },
  trainFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amenities: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amenitiesText: {
    fontSize: 11,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceUnit: {
    fontSize: 11,
    marginLeft: 4,
  },
  availabilityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  availabilityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  trainInfoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  trainInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trainInfoName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trainInfoRoute: {
    fontSize: 12,
  },
  carriageCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  carriageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  carriageNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  carriageTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  carriageTypeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  carriageDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  carriageDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  carriageDetailText: {
    fontSize: 12,
  },
  carriageAmenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  carriageAmenity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  carriageAmenityText: {
    fontSize: 11,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  seatMap: {
    marginBottom: 20,
  },
  seatLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 11,
  },
  seatsGrid: {
    gap: 12,
  },
  seatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seat: {
    flex: 1,
    margin: 4,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  seatUnavailable: {
    opacity: 0.5,
  },
  seatSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  seatNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  continueButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  passengerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  passengerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passengerNumber: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#3b82f620',
    borderRadius: 6,
  },
  passengerNumberText: {
    fontSize: 11,
    fontWeight: '500',
  },
  passengerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  passengerDetails: {
    fontSize: 12,
  },
  addPassengerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
    marginBottom: 20,
  },
  addPassengerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  tripSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tripPoint: {
    alignItems: 'center',
  },
  tripStation: {
    fontSize: 14,
    fontWeight: '500',
  },
  tripTime: {
    fontSize: 12,
    marginTop: 4,
  },
  tripDuration: {
    fontSize: 12,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  totalCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  totalNote: {
    fontSize: 11,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 30,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  stationsList: {
    maxHeight: 400,
  },
  stationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '500',
  },
  stationCity: {
    fontSize: 12,
    marginTop: 2,
  },
  passengerModal: {
    width: '90%',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  passengerInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  genderSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  genderOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  genderText: {
    fontSize: 14,
  },
  savePassengerButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  savePassengerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentModal: {
    width: '90%',
    borderRadius: 16,
    padding: 20,
  },
  paymentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  paymentAmount: {
    alignItems: 'center',
    marginBottom: 20,
  },
  paymentAmountLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  paymentAmountValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    marginBottom: 20,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  paymentMethodDesc: {
    fontSize: 12,
  },
  paymentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ticketCard: {
    width: '95%',
    maxHeight: '90%',
    borderRadius: 20,
    padding: 20,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  ticketQR: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrCode: {
    width: 160,
    height: 160,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 12,
  },
  reference: {
    fontSize: 12,
    marginTop: 8,
  },
  ticketInfo: {
    gap: 12,
  },
  ticketInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ticketInfoLabel: {
    fontSize: 13,
  },
  ticketInfoValue: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  ticketDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
  },
  ticketSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  passengerRow: {
    marginBottom: 8,
  },
  ticketFooter: {
    marginTop: 20,
    alignItems: 'center',
  },
  ticketNote: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    width: '100%',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});