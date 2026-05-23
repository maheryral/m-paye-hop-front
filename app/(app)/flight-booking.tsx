// app/(app)/flight-booking.tsx
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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { useTheme } from '../../src/contexts/ThemeContext';

// Types
interface Airport {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  image: string;
}

interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  fromAirport: string;
  toAirport: string;
  fromCity: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  duration: string;
  price: number;
  seatsAvailable: number;
  baggage: string;
  cabinBaggage: string;
  meal: boolean;
  wifi: boolean;
  entertainment: boolean;
  powerOutlet: boolean;
}

interface Seat {
  id: string;
  number: string;
  row: number;
  column: string;
  type: 'window' | 'aisle' | 'middle';
  isAvailable: boolean;
  price: number;
}

interface Passenger {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  nationality: string;
  passportNumber: string;
}

interface Booking {
  id: string;
  flight: Flight;
  selectedSeats: Seat[];
  passengers: Passenger[];
  totalPrice: number;
  bookingReference: string;
  qrCode: string;
  bookingDate: Date;
}

export default function FlightBooking() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, fetchBalance } = useWallet();
  const { colors } = useTheme();
  
  // États pour la recherche
  const [fromAirport, setFromAirport] = useState<Airport | null>(null);
  const [toAirport, setToAirport] = useState<Airport | null>(null);
  const [departureDate, setDepartureDate] = useState<Date>(new Date());
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [tripType, setTripType] = useState<'oneWay' | 'roundTrip'>('oneWay');
  const [passengerCount, setPassengerCount] = useState(1);
  const [showFromAirportModal, setShowFromAirportModal] = useState(false);
  const [showToAirportModal, setShowToAirportModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searching, setSearching] = useState(false);
  
  // États pour les vols
  const [availableFlights, setAvailableFlights] = useState<Flight[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [returnFlight, setReturnFlight] = useState<Flight | null>(null);
  
  // États pour la sélection des sièges
  const [availableSeats, setAvailableSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [showSeatSelection, setShowSeatSelection] = useState(false);
  
  // États pour les passagers
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [showPassengerForm, setShowPassengerForm] = useState(false);
  const [currentPassenger, setCurrentPassenger] = useState<Passenger | null>(null);
  const [passengerIndex, setPassengerIndex] = useState(0);
  
  // États pour les options
  const [extraBaggage, setExtraBaggage] = useState(0);
  const [travelInsurance, setTravelInsurance] = useState(false);
  const [mealPreference, setMealPreference] = useState('');
  
  // États pour le paiement
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Aéroports disponibles
  const airports: Airport[] = [
    { id: '1', code: 'TNR', name: 'Aéroport International d\'Ivato', city: 'Antananarivo', country: 'Madagascar', image: '' },
    { id: '2', code: 'NOS', name: 'Aéroport de Fascène', city: 'Nosy Be', country: 'Madagascar', image: '' },
    { id: '3', code: 'MJN', name: 'Aéroport Amborovy', city: 'Mahajanga', country: 'Madagascar', image: '' },
    { id: '4', code: 'TMM', name: 'Aéroport Toamasina', city: 'Toamasina', country: 'Madagascar', image: '' },
    { id: '5', code: 'WMR', name: 'Aéroport de Mananara', city: 'Mananara', country: 'Madagascar', image: '' },
    { id: '6', code: 'WVK', name: 'Aéroport Manakara', city: 'Manakara', country: 'Madagascar', image: '' },
    { id: '7', code: 'FTU', name: 'Aéroport Tôlanaro', city: 'Fort Dauphin', country: 'Madagascar', image: '' },
    { id: '8', code: 'DIE', name: 'Aéroport Arrachart', city: 'Antsiranana', country: 'Madagascar', image: '' },
    { id: '9', code: 'ZSE', name: 'Aéroport Pierre Claver', city: 'Saint-Pierre', country: 'Réunion', image: '' },
    { id: '10', code: 'MRU', name: 'Aéroport International SSR', city: 'Maurice', country: 'Maurice', image: '' },
  ];

  // Vols simulés
  const generateFlights = (from: Airport, to: Airport) => {
    const airlines = ['Air Madagascar', 'Ethiopian Airlines', 'Kenya Airways', 'Air Austral', 'Turkish Airlines'];
    const basePrice = Math.floor(Math.random() * 300000) + 200000;
    
    const flights: Flight[] = [];
    for (let i = 0; i < 5; i++) {
      const hour = 6 + i * 3;
      flights.push({
        id: `FL${Math.random().toString(36).substr(2, 6)}`,
        airline: airlines[Math.floor(Math.random() * airlines.length)],
        flightNumber: `MD${Math.floor(Math.random() * 1000)}`,
        fromAirport: from.code,
        toAirport: to.code,
        fromCity: from.city,
        toCity: to.city,
        departureDate: departureDate.toISOString(),
        departureTime: `${hour.toString().padStart(2, '0')}:00`,
        arrivalDate: departureDate.toISOString(),
        arrivalTime: `${(hour + 1 + Math.floor(Math.random() * 2)).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        duration: `${1 + Math.floor(Math.random() * 3)}h${Math.floor(Math.random() * 60)}`,
        price: basePrice + (i * 20000),
        seatsAvailable: Math.floor(Math.random() * 50) + 20,
        baggage: '23kg',
        cabinBaggage: '7kg',
        meal: true,
        wifi: i % 2 === 0,
        entertainment: i % 3 !== 0,
        powerOutlet: i % 4 === 0,
      });
    }
    return flights;
  };

  const handleSearchFlights = () => {
    if (!fromAirport || !toAirport) {
      Alert.alert('Erreur', 'Veuillez sélectionner les aéroports');
      return;
    }

    if (fromAirport.id === toAirport.id) {
      Alert.alert('Erreur', 'Les aéroports de départ et d\'arrivée doivent être différents');
      return;
    }

    setSearching(true);
    setTimeout(() => {
      const flights = generateFlights(fromAirport, toAirport);
      setAvailableFlights(flights);
      setSearching(false);
      setStep(2);
    }, 1500);
  };

  const handleFlightSelect = (flight: Flight, isReturn = false) => {
    if (isReturn) {
      setReturnFlight(flight);
    } else {
      setSelectedFlight(flight);
    }
  };

  const handleContinueToSeats = () => {
    if (!selectedFlight) {
      Alert.alert('Erreur', 'Veuillez sélectionner un vol');
      return;
    }
    if (tripType === 'roundTrip' && !returnFlight) {
      Alert.alert('Erreur', 'Veuillez sélectionner le vol retour');
      return;
    }
    
    // Générer les sièges disponibles
    const seats: Seat[] = [];
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const columns = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    rows.forEach(row => {
      columns.forEach(col => {
        const isAvailable = Math.random() > 0.4;
        let type: 'window' | 'aisle' | 'middle' = 'middle';
        if (col === 'A' || col === 'F') type = 'window';
        if (col === 'C' || col === 'D') type = 'aisle';
        
        seats.push({
          id: `${row}${col}`,
          number: `${row}${col}`,
          row,
          column: col,
          type,
          isAvailable,
          price: type === 'window' ? 15000 : type === 'aisle' ? 12000 : 10000,
        });
      });
    });
    
    setAvailableSeats(seats);
    setStep(3);
  };

  const handleSeatSelect = (seat: Seat) => {
    if (!seat.isAvailable) return;
    
    const isSelected = selectedSeats.find(s => s.id === seat.id);
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length < passengerCount) {
        setSelectedSeats([...selectedSeats, seat]);
      } else {
        Alert.alert('Limite atteinte', `Vous ne pouvez sélectionner que ${passengerCount} siège(s)`);
      }
    }
  };

  const handleContinueToPassengers = () => {
    if (selectedSeats.length !== passengerCount) {
      Alert.alert('Erreur', `Veuillez sélectionner ${passengerCount} siège(s)`);
      return;
    }
    
    // Initialiser les passagers
    const newPassengers: Passenger[] = [];
    for (let i = 0; i < passengerCount; i++) {
      newPassengers.push({
        id: `P${i + 1}`,
        firstName: '',
        lastName: '',
        birthDate: '',
        nationality: 'Malagasy',
        passportNumber: '',
      });
    }
    setPassengers(newPassengers);
    setCurrentPassenger(newPassengers[0]);
    setPassengerIndex(0);
    setShowPassengerForm(true);
    setStep(4);
  };

  const handleSavePassenger = () => {
    if (!currentPassenger) return;
    
    if (!currentPassenger.firstName || !currentPassenger.lastName || !currentPassenger.birthDate) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    const updatedPassengers = [...passengers];
    updatedPassengers[passengerIndex] = currentPassenger;
    setPassengers(updatedPassengers);
    
    if (passengerIndex < passengerCount - 1) {
      setPassengerIndex(passengerIndex + 1);
      setCurrentPassenger(updatedPassengers[passengerIndex + 1]);
    } else {
      setShowPassengerForm(false);
      setStep(5);
    }
  };

  const calculateTotalPrice = () => {
    const flightPrice = selectedFlight?.price || 0;
    const returnPrice = returnFlight?.price || 0;
    const seatsPrice = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const baggagePrice = extraBaggage * 50000;
    const insurancePrice = travelInsurance ? 25000 : 0;
    
    return (flightPrice + returnPrice) * passengerCount + seatsPrice + baggagePrice + insurancePrice;
  };

  const handlePayment = async () => {
    const totalPrice = calculateTotalPrice();
    
    if (balance < totalPrice) {
      Alert.alert('Solde insuffisant', 'Veuillez recharger votre compte');
      return;
    }

    setLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newBooking: Booking = {
        id: Math.random().toString(36).substr(2, 9),
        flight: selectedFlight!,
        selectedSeats,
        passengers,
        totalPrice,
        bookingReference: `FL${Math.floor(Math.random() * 1000000)}`,
        qrCode: `FLY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        bookingDate: new Date(),
      };
      
      setBooking(newBooking);
      setShowPaymentModal(false);
      setShowTicketModal(true);
      await fetchBalance();
    } catch (error) {
      Alert.alert('Erreur', 'Le paiement a échoué');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Type de voyage</Text>
      
      <View style={styles.tripTypeContainer}>
        <TouchableOpacity
          style={[styles.tripTypeButton, tripType === 'oneWay' && { backgroundColor: colors.primary }]}
          onPress={() => setTripType('oneWay')}
        >
          <Text style={[styles.tripTypeText, tripType === 'oneWay' && { color: '#fff' }]}>Aller simple</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tripTypeButton, tripType === 'roundTrip' && { backgroundColor: colors.primary }]}
          onPress={() => setTripType('roundTrip')}
        >
          <Text style={[styles.tripTypeText, tripType === 'roundTrip' && { color: '#fff' }]}>Aller-retour</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Aéroports</Text>
      
      <TouchableOpacity 
        style={[styles.airportCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowFromAirportModal(true)}
      >
        <View style={styles.airportIcon}>
          <Ionicons name="airplane-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.airportInfo}>
          <Text style={[styles.airportLabel, { color: colors.textSecondary }]}>Départ</Text>
          <Text style={[styles.airportName, { color: colors.text }]}>
            {fromAirport ? `${fromAirport.city} (${fromAirport.code})` : 'Choisir l\'aéroport'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.swapIcon}>
        <Ionicons name="swap-vertical" size={24} color={colors.primary} />
      </View>

      <TouchableOpacity 
        style={[styles.airportCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowToAirportModal(true)}
      >
        <View style={styles.airportIcon}>
          <Ionicons name="location-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.airportInfo}>
          <Text style={[styles.airportLabel, { color: colors.textSecondary }]}>Arrivée</Text>
          <Text style={[styles.airportName, { color: colors.text }]}>
            {toAirport ? `${toAirport.city} (${toAirport.code})` : 'Choisir l\'aéroport'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Date</Text>
      
      <TouchableOpacity 
        style={[styles.dateCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowDatePicker(true)}
      >
        <Ionicons name="calendar-outline" size={24} color={colors.primary} />
        <View style={styles.dateInfo}>
          <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Départ</Text>
          <Text style={[styles.dateValue, { color: colors.text }]}>
            {departureDate.toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </TouchableOpacity>

      {tripType === 'roundTrip' && (
        <TouchableOpacity 
          style={[styles.dateCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={24} color={colors.primary} />
          <View style={styles.dateInfo}>
            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Retour</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>
              {returnDate ? returnDate.toLocaleDateString('fr-FR') : 'Choisir la date'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Passagers</Text>
      
      <View style={[styles.passengerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="people-outline" size={24} color={colors.primary} />
        <View style={styles.passengerInfo}>
          <Text style={[styles.passengerLabel, { color: colors.textSecondary }]}>Nombre de passagers</Text>
          <View style={styles.passengerControls}>
            <TouchableOpacity 
              style={[styles.passengerButton, { borderColor: colors.border }]}
              onPress={() => setPassengerCount(Math.max(1, passengerCount - 1))}
            >
              <Ionicons name="remove" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.passengerCount, { color: colors.text }]}>{passengerCount}</Text>
            <TouchableOpacity 
              style={[styles.passengerButton, { borderColor: colors.border }]}
              onPress={() => setPassengerCount(Math.min(9, passengerCount + 1))}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.searchButton, { backgroundColor: colors.primary }]}
        onPress={handleSearchFlights}
        disabled={searching}
      >
        {searching ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="search-outline" size={20} color="#fff" />
            <Text style={styles.searchButtonText}>Rechercher des vols</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Vols disponibles
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.routeInfo, { color: colors.textSecondary }]}>
          {fromAirport?.city} → {toAirport?.city} • {departureDate.toLocaleDateString('fr-FR')}
        </Text>

        {availableFlights.map((flight) => (
          <TouchableOpacity
            key={flight.id}
            style={[
              styles.flightCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedFlight?.id === flight.id && { borderColor: colors.primary, borderWidth: 2 }
            ]}
            onPress={() => handleFlightSelect(flight)}
          >
            <View style={styles.flightHeader}>
              <View>
                <Text style={[styles.airlineName, { color: colors.text }]}>{flight.airline}</Text>
                <Text style={[styles.flightNumber, { color: colors.textSecondary }]}>{flight.flightNumber}</Text>
              </View>
              <Text style={[styles.flightPrice, { color: colors.primary }]}>
                {flight.price.toLocaleString()} Ar
              </Text>
            </View>

            <View style={styles.flightTimes}>
              <View style={styles.timeContainer}>
                <Text style={[styles.time, { color: colors.text }]}>{flight.departureTime}</Text>
                <Text style={[styles.city, { color: colors.textSecondary }]}>{flight.fromCity}</Text>
              </View>
              
              <View style={styles.flightDuration}>
                <View style={styles.durationLine} />
                <Text style={[styles.durationText, { color: colors.textSecondary }]}>{flight.duration}</Text>
                <Ionicons name="airplane-outline" size={16} color={colors.primary} />
              </View>
              
              <View style={styles.timeContainer}>
                <Text style={[styles.time, { color: colors.text }]}>{flight.arrivalTime}</Text>
                <Text style={[styles.city, { color: colors.textSecondary }]}>{flight.toCity}</Text>
              </View>
            </View>

            <View style={styles.flightFeatures}>
              {flight.meal && (
                <View style={styles.feature}>
                  <Ionicons name="restaurant-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Repas</Text>
                </View>
              )}
              {flight.wifi && (
                <View style={styles.feature}>
                  <Ionicons name="wifi-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>WiFi</Text>
                </View>
              )}
              {flight.entertainment && (
                <View style={styles.feature}>
                  <Ionicons name="tv-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>Divertissement</Text>
                </View>
              )}
              <Text style={[styles.baggage, { color: colors.textSecondary }]}>
                Bagage: {flight.baggage}
              </Text>
            </View>

            <Text style={[styles.seatsAvailable, { color: '#3b82f6' }]}>
              {flight.seatsAvailable} sièges disponibles
            </Text>
          </TouchableOpacity>
        ))}

        {tripType === 'roundTrip' && (
          <>
            <Text style={[styles.returnTitle, { color: colors.text }]}>Vol retour</Text>
            {availableFlights.map((flight) => (
              <TouchableOpacity
                key={`return-${flight.id}`}
                style={[
                  styles.flightCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  returnFlight?.id === flight.id && { borderColor: colors.primary, borderWidth: 2 }
                ]}
                onPress={() => handleFlightSelect(flight, true)}
              >
                {/* Même contenu que pour le vol aller */}
                <View style={styles.flightHeader}>
                  <View>
                    <Text style={[styles.airlineName, { color: colors.text }]}>{flight.airline}</Text>
                    <Text style={[styles.flightNumber, { color: colors.textSecondary }]}>{flight.flightNumber}</Text>
                  </View>
                  <Text style={[styles.flightPrice, { color: colors.primary }]}>
                    {flight.price.toLocaleString()} Ar
                  </Text>
                </View>

                <View style={styles.flightTimes}>
                  <View style={styles.timeContainer}>
                    <Text style={[styles.time, { color: colors.text }]}>{flight.departureTime}</Text>
                    <Text style={[styles.city, { color: colors.textSecondary }]}>{flight.fromCity}</Text>
                  </View>
                  
                  <View style={styles.flightDuration}>
                    <View style={styles.durationLine} />
                    <Text style={[styles.durationText, { color: colors.textSecondary }]}>{flight.duration}</Text>
                    <Ionicons name="airplane-outline" size={16} color={colors.primary} />
                  </View>
                  
                  <View style={styles.timeContainer}>
                    <Text style={[styles.time, { color: colors.text }]}>{flight.arrivalTime}</Text>
                    <Text style={[styles.city, { color: colors.textSecondary }]}>{flight.toCity}</Text>
                  </View>
                </View>

                <View style={styles.flightFeatures}>
                  {flight.meal && (
                    <View style={styles.feature}>
                      <Ionicons name="restaurant-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.featureText, { color: colors.textSecondary }]}>Repas</Text>
                    </View>
                  )}
                  {flight.wifi && (
                    <View style={styles.feature}>
                      <Ionicons name="wifi-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.featureText, { color: colors.textSecondary }]}>WiFi</Text>
                    </View>
                  )}
                  <Text style={[styles.baggage, { color: colors.textSecondary }]}>
                    Bagage: {flight.baggage}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <TouchableOpacity 
          style={[styles.continueButton, { backgroundColor: colors.primary }]}
          onPress={handleContinueToSeats}
        >
          <Text style={styles.continueButtonText}>Continuer vers les sièges</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderSeatSelection = () => (
    <Modal
      visible={showSeatSelection}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.seatModal, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sélectionnez vos sièges</Text>
            <TouchableOpacity onPress={() => setShowSeatSelection(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.planeLayout}>
            <View style={styles.planeHeader}>
              <Ionicons name="airplane" size={32} color={colors.primary} />
              <Text style={[styles.planeModel, { color: colors.text }]}>{selectedFlight?.airline}</Text>
            </View>

            <ScrollView>
              <View style={styles.seatsContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(row => (
                  <View key={row} style={styles.seatRow}>
                    <Text style={[styles.rowNumber, { color: colors.textSecondary }]}>{row}</Text>
                    {['A', 'B', 'C', 'D', 'E', 'F'].map(col => {
                      const seat = availableSeats.find(s => s.row === row && s.column === col);
                      if (!seat) return null;
                      const isSelected = selectedSeats.some(s => s.id === seat.id);
                      
                      return (
                        <TouchableOpacity
                          key={`${row}${col}`}
                          style={[
                            styles.seat,
                            !seat.isAvailable && styles.seatUnavailable,
                            isSelected && styles.seatSelected,
                            { backgroundColor: !seat.isAvailable ? '#ef444420' : (isSelected ? colors.primary : colors.card) }
                          ]}
                          onPress={() => handleSeatSelect(seat)}
                          disabled={!seat.isAvailable}
                        >
                          <Ionicons 
                            name={seat.type === 'window' ? 'airplane-outline' : 'person-outline'} 
                            size={16} 
                            color={!seat.isAvailable ? '#ef4444' : (isSelected ? '#fff' : colors.text)} 
                          />
                          <Text style={[
                            styles.seatNumber,
                            { color: !seat.isAvailable ? '#ef4444' : (isSelected ? '#fff' : colors.text) }
                          ]}>
                            {col}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

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
            </View>

            <TouchableOpacity 
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleContinueToPassengers}
            >
              <Text style={styles.confirmButtonText}>Confirmer les sièges</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderPassengerForm = () => (
    <Modal
      visible={showPassengerForm}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.passengerModal, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Passager {passengerIndex + 1} / {passengerCount}
            </Text>
            {passengerIndex > 0 && (
              <TouchableOpacity onPress={() => setShowPassengerForm(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Prénom"
              placeholderTextColor={colors.textSecondary}
              value={currentPassenger?.firstName}
              onChangeText={(text) => setCurrentPassenger({ ...currentPassenger!, firstName: text })}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Nom"
              placeholderTextColor={colors.textSecondary}
              value={currentPassenger?.lastName}
              onChangeText={(text) => setCurrentPassenger({ ...currentPassenger!, lastName: text })}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Date de naissance (JJ/MM/AAAA)"
              placeholderTextColor={colors.textSecondary}
              value={currentPassenger?.birthDate}
              onChangeText={(text) => setCurrentPassenger({ ...currentPassenger!, birthDate: text })}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Nationalité"
              placeholderTextColor={colors.textSecondary}
              value={currentPassenger?.nationality}
              onChangeText={(text) => setCurrentPassenger({ ...currentPassenger!, nationality: text })}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Numéro de passeport"
              placeholderTextColor={colors.textSecondary}
              value={currentPassenger?.passportNumber}
              onChangeText={(text) => setCurrentPassenger({ ...currentPassenger!, passportNumber: text })}
            />

            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSavePassenger}
            >
              <Text style={styles.saveButtonText}>
                {passengerIndex < passengerCount - 1 ? 'Passager suivant' : 'Terminer'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={() => setStep(4)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Options supplémentaires
        </Text>
      </View>

      <ScrollView>
        <View style={[styles.optionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.optionsTitle, { color: colors.text }]}>Bagages supplémentaires</Text>
          <View style={styles.optionItem}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Bagage en soute supplémentaire (23kg)</Text>
            <View style={styles.optionControls}>
              <TouchableOpacity 
                style={[styles.optionButton, { borderColor: colors.border }]}
                onPress={() => setExtraBaggage(Math.max(0, extraBaggage - 1))}
              >
                <Ionicons name="remove" size={16} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.optionValue, { color: colors.text }]}>{extraBaggage}</Text>
              <TouchableOpacity 
                style={[styles.optionButton, { borderColor: colors.border }]}
                onPress={() => setExtraBaggage(Math.min(5, extraBaggage + 1))}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.optionPrice, { color: colors.textSecondary }]}>
            {extraBaggage * 50000} Ar
          </Text>
        </View>

        <View style={[styles.optionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.optionItem}>
            <View>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Assurance voyage</Text>
              <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                Annulation, retard, bagage perdu
              </Text>
            </View>
            <Switch
              value={travelInsurance}
              onValueChange={setTravelInsurance}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <Text style={[styles.optionPrice, { color: colors.textSecondary }]}>
            25 000 Ar
          </Text>
        </View>

        <View style={[styles.optionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.optionsTitle, { color: colors.text }]}>Préférence repas</Text>
          <View style={styles.mealOptions}>
            {['Standard', 'Végétarien', 'Sans gluten', 'Halal', 'Cacher'].map((meal) => (
              <TouchableOpacity
                key={meal}
                style={[
                  styles.mealOption,
                  { borderColor: colors.border },
                  mealPreference === meal && { borderColor: colors.primary, backgroundColor: `${colors.primary}20` }
                ]}
                onPress={() => setMealPreference(meal)}
              >
                <Text style={[styles.mealText, { color: colors.text }]}>{meal}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Récapitulatif</Text>
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Vols</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {(selectedFlight?.price || 0) * passengerCount + (returnFlight?.price || 0) * passengerCount} Ar
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Sièges</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {selectedSeats.reduce((sum, seat) => sum + seat.price, 0)} Ar
            </Text>
          </View>
          
          {extraBaggage > 0 && (
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Bagages</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{extraBaggage * 50000} Ar</Text>
            </View>
          )}
          
          {travelInsurance && (
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Assurance</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>25 000 Ar</Text>
            </View>
          )}
          
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {calculateTotalPrice().toLocaleString()} Ar
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.payButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowPaymentModal(true)}
        >
          <Ionicons name="card-outline" size={24} color="#fff" />
          <Text style={styles.payButtonText}>Payer maintenant</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderPaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.paymentModal, { backgroundColor: colors.card }]}>
          <Text style={[styles.paymentTitle, { color: colors.text }]}>Confirmation de paiement</Text>
          
          <View style={styles.paymentAmount}>
            <Text style={[styles.paymentAmountLabel, { color: colors.textSecondary }]}>Montant à payer</Text>
            <Text style={[styles.paymentAmountValue, { color: colors.primary }]}>
              {calculateTotalPrice().toLocaleString()} Ar
            </Text>
          </View>

          <View style={styles.paymentMethod}>
            <Ionicons name="wallet-outline" size={32} color={colors.primary} />
            <View>
              <Text style={[styles.paymentMethodTitle, { color: colors.text }]}>Portefeuille M'Paye</Text>
              <Text style={[styles.paymentMethodBalance, { color: colors.textSecondary }]}>
                Solde: {balance.toLocaleString()} Ar
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
              onPress={handlePayment}
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

  const renderTicketModal = () => (
    <Modal
      visible={showTicketModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.ticketCard, { backgroundColor: colors.card }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.ticketHeader}>
              <Ionicons name="airplane" size={40} color={colors.primary} />
              <Text style={[styles.ticketTitle, { color: colors.text }]}>Billet d'avion</Text>
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
                <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Passager</Text>
                <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                  {booking?.passengers[0]?.firstName} {booking?.passengers[0]?.lastName}
                </Text>
              </View>
              
              <View style={styles.ticketInfoRow}>
                <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Vol</Text>
                <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.flight.flightNumber}</Text>
              </View>
              
              <View style={styles.ticketInfoRow}>
                <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>De</Text>
                <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.flight.fromCity}</Text>
              </View>
              
              <View style={styles.ticketInfoRow}>
                <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>À</Text>
                <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.flight.toCity}</Text>
              </View>
              
              <View style={styles.ticketInfoRow}>
                <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Date</Text>
                <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                  {new Date(booking?.flight.departureDate || '').toLocaleDateString('fr-FR')}
                </Text>
              </View>
              
              <View style={styles.ticketInfoRow}>
                <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Heure</Text>
                <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.flight.departureTime}</Text>
              </View>
              
              <View style={styles.ticketInfoRow}>
                <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Sièges</Text>
                <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                  {booking?.selectedSeats.map(s => s.number).join(', ')}
                </Text>
              </View>
              
              <View style={styles.ticketDivider} />
              
              <View style={styles.ticketInfoRow}>
                <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary, fontSize: 16 }]}>Total payé</Text>
                <Text style={[styles.ticketInfoValue, { color: colors.primary, fontSize: 20, fontWeight: 'bold' }]}>
                  {booking?.totalPrice.toLocaleString()} Ar
                </Text>
              </View>
            </View>

            <View style={styles.ticketFooter}>
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
      </View>
    </Modal>
  );

  const renderAirportModal = (type: 'from' | 'to') => (
    <Modal
      visible={type === 'from' ? showFromAirportModal : showToAirportModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.airportModal, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {type === 'from' ? 'Aéroport de départ' : "Aéroport d'arrivée"}
            </Text>
            <TouchableOpacity onPress={() => {
              if (type === 'from') setShowFromAirportModal(false);
              else setShowToAirportModal(false);
            }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {airports.map((airport) => (
              <TouchableOpacity
                key={airport.id}
                style={[styles.airportItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  if (type === 'from') {
                    setFromAirport(airport);
                    setShowFromAirportModal(false);
                  } else {
                    setToAirport(airport);
                    setShowToAirportModal(false);
                  }
                }}
              >
                <View>
                  <Text style={[styles.airportItemCode, { color: colors.text }]}>{airport.code}</Text>
                  <Text style={[styles.airportItemName, { color: colors.text }]}>{airport.city}</Text>
                  <Text style={[styles.airportItemFull, { color: colors.textSecondary }]}>{airport.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Réservation de vol</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]}>
            <Text style={styles.progressStepText}>1</Text>
          </View>
          <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
          <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]}>
            <Text style={styles.progressStepText}>2</Text>
          </View>
          <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
          <View style={[styles.progressStep, step >= 3 && styles.progressStepActive]}>
            <Text style={styles.progressStepText}>3</Text>
          </View>
          <View style={[styles.progressLine, step >= 4 && styles.progressLineActive]} />
          <View style={[styles.progressStep, step >= 4 && styles.progressStepActive]}>
            <Text style={styles.progressStepText}>4</Text>
          </View>
          <View style={[styles.progressLine, step >= 5 && styles.progressLineActive]} />
          <View style={[styles.progressStep, step >= 5 && styles.progressStepActive]}>
            <Text style={styles.progressStepText}>5</Text>
          </View>
        </View>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderSeatSelection()}
        {step === 4 && renderPassengerForm()}
        {step === 5 && renderStep5()}

        {renderAirportModal('from')}
        {renderAirportModal('to')}
        {renderPaymentModal()}
        {renderTicketModal()}
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
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: '#3b82f6',
  },
  progressStepText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#3b82f6',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  tripTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  tripTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  tripTypeText: {
    color: '#fff',
    fontWeight: '500',
  },
  airportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  airportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f620',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  airportInfo: {
    flex: 1,
  },
  airportLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  airportName: {
    fontSize: 14,
    fontWeight: '500',
  },
  swapIcon: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  passengerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  passengerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  passengerLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  passengerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passengerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerCount: {
    fontSize: 16,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'center',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 30,
    marginBottom: 30,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  routeInfo: {
    fontSize: 14,
    marginBottom: 16,
  },
  flightCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  flightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  airlineName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  flightNumber: {
    fontSize: 12,
    marginTop: 2,
  },
  flightPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  flightTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    alignItems: 'center',
  },
  time: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  city: {
    fontSize: 12,
    marginTop: 2,
  },
  flightDuration: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  durationLine: {
    height: 1,
    backgroundColor: '#334155',
    width: '100%',
    marginBottom: 4,
  },
  durationText: {
    fontSize: 10,
    marginVertical: 2,
  },
  flightFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 11,
  },
  baggage: {
    fontSize: 11,
  },
  seatsAvailable: {
    fontSize: 12,
  },
  returnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
    marginBottom: 30,
  },
  continueButtonText: {
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
  seatModal: {
    width: '95%',
    height: '90%',
    borderRadius: 16,
    padding: 20,
  },
  planeLayout: {
    flex: 1,
  },
  planeHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  planeModel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  seatsContainer: {
    gap: 8,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowNumber: {
    width: 30,
    fontSize: 12,
    textAlign: 'center',
  },
  seat: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  seatUnavailable: {
    opacity: 0.5,
  },
  seatSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  seatNumber: {
    fontSize: 10,
    marginTop: 2,
  },
  seatLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
  },
  passengerModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  saveButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionsCard: {
    borderRadius: 12,
        borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  optionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionValue: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 24,
    textAlign: 'center',
  },
  optionPrice: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  mealOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  mealOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  mealText: {
    fontSize: 13,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryItem: {
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
  totalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
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
  paymentMethodBalance: {
    fontSize: 12,
    marginTop: 4,
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
  },
  ticketDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
  },
  ticketFooter: {
    marginTop: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  airportModal: {
    width: '90%',
    maxHeight: '80%',
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  airportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  airportItemCode: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  airportItemName: {
    fontSize: 14,
    marginTop: 2,
  },
  airportItemFull: {
    fontSize: 12,
    marginTop: 2,
  },
});