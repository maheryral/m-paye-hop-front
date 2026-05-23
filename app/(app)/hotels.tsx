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
interface Hotel {
  id: string;
  name: string;
  location: string;
  rating: number;
  pricePerNight: number;
  images: string[];
  amenities: string[];
  description: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  latitude: number;
  longitude: number;
}

interface Room {
  id: string;
  hotelId: string;
  type: string;
  capacity: number;
  bedType: string;
  price: number;
  available: number;
  amenities: string[];
  images: string[];
  size: number;
  floor: number;
  view: string;
}

interface Booking {
  id: string;
  hotel: Hotel;
  room: Room;
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
  totalPrice: number;
  guestName: string;
  guestPhone: string;
  specialRequests: string;
  qrCode: string;
  bookingReference: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}

export default function HotelBooking() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [checkInDate, setCheckInDate] = useState<Date>(new Date());
  const [checkOutDate, setCheckOutDate] = useState<Date>(new Date(Date.now() + 86400000));
  const [guests, setGuests] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [showCheckInPicker, setShowCheckInPicker] = useState(false);
  const [showCheckOutPicker, setShowCheckOutPicker] = useState(false);
  const [showGuestsModal, setShowGuestsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);

  // Données mockées des hôtels
  const hotelsData: Hotel[] = [
    {
      id: '1',
      name: 'Hôtel Colbert',
      location: 'Antananarivo Centre',
      rating: 4.8,
      pricePerNight: 250000,
      images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
      amenities: ['Piscine', 'Spa', 'Restaurant', 'WiFi', 'Parking', 'Gym'],
      description: 'Hôtel de luxe au cœur d\'Antananarivo avec vue imprenable sur la ville.',
      phone: '+261 34 12 345 67',
      email: 'contact@colbert.mg',
      checkIn: '14:00',
      checkOut: '12:00',
      latitude: -18.8792,
      longitude: 47.5079,
    },
    {
      id: '2',
      name: 'Carlton Madagascar',
      location: 'Antananarivo',
      rating: 4.9,
      pricePerNight: 350000,
      images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
      amenities: ['Piscine', 'Spa', 'Restaurant', 'Bar', 'WiFi', 'Parking', 'Gym', 'Casino'],
      description: 'Hôtel 5 étoiles offrant des services premium et une vue panoramique.',
      phone: '+261 34 23 456 78',
      email: 'info@carlton.mg',
      checkIn: '15:00',
      checkOut: '11:00',
      latitude: -18.8800,
      longitude: 47.5080,
    },
    {
      id: '3',
      name: 'Hôtel La Ribaudière',
      location: 'Antsirabe',
      rating: 4.6,
      pricePerNight: 180000,
      images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a'],
      amenities: ['Restaurant', 'WiFi', 'Parking', 'Jardin', 'Salle de réunion'],
      description: 'Hôtel charmant dans un cadre verdoyant à Antsirabe.',
      phone: '+261 34 34 567 89',
      email: 'contact@ribaudiere.mg',
      checkIn: '14:00',
      checkOut: '12:00',
      latitude: -19.8668,
      longitude: 47.0333,
    },
    {
      id: '4',
      name: 'Hôtel Sofia',
      location: 'Nosy Be',
      rating: 4.7,
      pricePerNight: 280000,
      images: ['https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9'],
      amenities: ['Piscine', 'Plage', 'Restaurant', 'Bar', 'WiFi', 'Spa'],
      description: 'Hôtel de plage paradisiaque à Nosy Be.',
      phone: '+261 34 45 678 90',
      email: 'info@sofia.mg',
      checkIn: '14:00',
      checkOut: '11:00',
      latitude: -13.3125,
      longitude: 48.2858,
    },
    {
      id: '5',
      name: 'Hôtel Lakana',
      location: 'Antsiranana',
      rating: 4.5,
      pricePerNight: 150000,
      images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
      amenities: ['WiFi', 'Parking', 'Restaurant', 'Bar'],
      description: 'Hôtel confortable avec vue sur la baie de Diego Suarez.',
      phone: '+261 34 56 789 01',
      email: 'contact@lakana.mg',
      checkIn: '13:00',
      checkOut: '11:00',
      latitude: -12.2786,
      longitude: 49.2917,
    },
    {
      id: '6',
      name: 'Hôtel Palissandre',
      location: 'Fianarantsoa',
      rating: 4.4,
      pricePerNight: 120000,
      images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
      amenities: ['WiFi', 'Parking', 'Restaurant', 'Jardin'],
      description: 'Hôtel de charme au cœur de la ville de Fianarantsoa.',
      phone: '+261 34 67 890 12',
      email: 'info@palissandre.mg',
      checkIn: '14:00',
      checkOut: '12:00',
      latitude: -21.4544,
      longitude: 47.0856,
    },
  ];

  // Types de chambres par hôtel
  const roomsData: { [key: string]: Room[] } = {
    '1': [
      {
        id: 'r1_1',
        hotelId: '1',
        type: 'Chambre Standard',
        capacity: 2,
        bedType: 'Lit double',
        price: 250000,
        available: 5,
        amenities: ['Climatisation', 'TV', 'Mini-bar', 'WiFi'],
        images: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39'],
        size: 25,
        floor: 1,
        view: 'Ville',
      },
      {
        id: 'r1_2',
        hotelId: '1',
        type: 'Chambre Deluxe',
        capacity: 2,
        bedType: 'Lit king size',
        price: 350000,
        available: 3,
        amenities: ['Climatisation', 'TV', 'Mini-bar', 'WiFi', 'Baignoire', 'Balcon'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427'],
        size: 35,
        floor: 2,
        view: 'Piscine',
      },
      {
        id: 'r1_3',
        hotelId: '1',
        type: 'Suite Junior',
        capacity: 3,
        bedType: 'Lit king size + canapé',
        price: 450000,
        available: 2,
        amenities: ['Climatisation', 'TV', 'Mini-bar', 'WiFi', 'Baignoire', 'Balcon', 'Salon'],
        images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
        size: 50,
        floor: 3,
        view: 'Ville',
      },
    ],
    '2': [
      {
        id: 'r2_1',
        hotelId: '2',
        type: 'Chambre Standard',
        capacity: 2,
        bedType: 'Lit double',
        price: 350000,
        available: 8,
        amenities: ['Climatisation', 'TV', 'Mini-bar', 'WiFi'],
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
        size: 28,
        floor: 1,
        view: 'Ville',
      },
      {
        id: 'r2_2',
        hotelId: '2',
        type: 'Chambre Exécutive',
        capacity: 2,
        bedType: 'Lit king size',
        price: 500000,
        available: 4,
        amenities: ['Climatisation', 'TV', 'Mini-bar', 'WiFi', 'Baignoire', 'Balcon', 'Accès lounge'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427'],
        size: 40,
        floor: 4,
        view: 'Ville',
      },
      {
        id: 'r2_3',
        hotelId: '2',
        type: 'Suite Présidentielle',
        capacity: 4,
        bedType: '2 lits king size',
        price: 800000,
        available: 1,
        amenities: ['Climatisation', 'TV', 'Mini-bar', 'WiFi', 'Baignoire', 'Balcon', 'Salon', 'Cuisine'],
        images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
        size: 80,
        floor: 5,
        view: 'Panoramique',
      },
    ],
    '3': [
      {
        id: 'r3_1',
        hotelId: '3',
        type: 'Chambre Simple',
        capacity: 1,
        bedType: 'Lit simple',
        price: 120000,
        available: 6,
        amenities: ['Climatisation', 'TV', 'WiFi'],
        images: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39'],
        size: 20,
        floor: 1,
        view: 'Jardin',
      },
      {
        id: 'r3_2',
        hotelId: '3',
        type: 'Chambre Double',
        capacity: 2,
        bedType: 'Lit double',
        price: 180000,
        available: 4,
        amenities: ['Climatisation', 'TV', 'WiFi', 'Mini-bar'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427'],
        size: 25,
        floor: 2,
        view: 'Jardin',
      },
    ],
    '4': [
      {
        id: 'r4_1',
        hotelId: '4',
        type: 'Bungalow Plage',
        capacity: 2,
        bedType: 'Lit king size',
        price: 280000,
        available: 5,
        amenities: ['Climatisation', 'TV', 'Mini-bar', 'WiFi', 'Terrasse', 'Accès plage'],
        images: ['https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9'],
        size: 30,
        floor: 1,
        view: 'Mer',
      },
      {
        id: 'r4_2',
        hotelId: '4',
        type: 'Villa Familiale',
        capacity: 6,
        bedType: '3 lits king size',
        price: 600000,
        available: 2,
        amenities: ['Climatisation', 'TV', 'Mini-bar', 'WiFi', 'Piscine privée', 'Cuisine', 'Jardin'],
        images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
        size: 120,
        floor: 1,
        view: 'Mer',
      },
    ],
    '5': [
      {
        id: 'r5_1',
        hotelId: '5',
        type: 'Chambre Standard',
        capacity: 2,
        bedType: 'Lit double',
        price: 150000,
        available: 7,
        amenities: ['Climatisation', 'TV', 'WiFi'],
        images: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39'],
        size: 22,
        floor: 1,
        view: 'Ville',
      },
    ],
    '6': [
      {
        id: 'r6_1',
        hotelId: '6',
        type: 'Chambre Économique',
        capacity: 2,
        bedType: 'Lit double',
        price: 120000,
        available: 8,
        amenities: ['WiFi', 'TV'],
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
        size: 18,
        floor: 1,
        view: 'Jardin',
      },
    ],
  };

  useEffect(() => {
    setHotels(hotelsData);
  }, []);

  const calculateTotalPrice = () => {
    if (!selectedRoom) return 0;
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24));
    return selectedRoom.price * nights;
  };

  const handleHotelSelect = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setRooms(roomsData[hotel.id] || []);
    setStep(2);
  };

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setStep(3);
  };

  const handleBooking = async () => {
    if (!selectedHotel || !selectedRoom) return;

    const totalPrice = calculateTotalPrice();
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24));

    setLoading(true);
    
    try {
      // Simulation d'appel API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newBooking: Booking = {
        id: Math.random().toString(36).substr(2, 9),
        hotel: selectedHotel,
        room: selectedRoom,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        guests: guests,
        totalPrice: totalPrice,
        guestName: user?.prenom ? `${user.prenom} ${user.nom}` : 'Client',
        guestPhone: user?.telephone || 'Non renseigné',
        specialRequests: specialRequests,
        qrCode: `HTL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        bookingReference: `H${Math.floor(Math.random() * 1000000)}`,
        status: 'PENDING',
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

  const filteredHotels = hotels.filter(hotel => {
    const matchesSearch = hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          hotel.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = selectedCity ? hotel.location.includes(selectedCity) : true;
    const matchesRating = selectedRating ? hotel.rating >= selectedRating : true;
    const matchesPrice = hotel.pricePerNight >= priceRange[0] && hotel.pricePerNight <= priceRange[1];
    return matchesSearch && matchesCity && matchesRating && matchesPrice;
  });

  const HotelCard = ({ hotel }: { hotel: Hotel }) => (
    <TouchableOpacity
      style={[styles.hotelCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleHotelSelect(hotel)}
    >
      <Image source={{ uri: hotel.images[0] }} style={styles.hotelImage} />
      <View style={styles.hotelOverlay}>
        <View style={styles.hotelRating}>
          <Ionicons name="star" size={16} color="#fbbf24" />
          <Text style={styles.ratingText}>{hotel.rating}</Text>
        </View>
      </View>
      <View style={styles.hotelInfo}>
        <Text style={[styles.hotelName, { color: colors.text }]}>{hotel.name}</Text>
        <View style={styles.hotelLocation}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.hotelLocationText, { color: colors.textSecondary }]}>{hotel.location}</Text>
        </View>
        <View style={styles.hotelAmenities}>
          {hotel.amenities.slice(0, 3).map((amenity, index) => (
            <View key={index} style={styles.amenityTag}>
              <Text style={styles.amenityTagText}>{amenity}</Text>
            </View>
          ))}
        </View>
        <View style={styles.hotelFooter}>
          <Text style={[styles.hotelPrice, { color: colors.primary }]}>
            {hotel.pricePerNight.toLocaleString()} Ar
          </Text>
          <Text style={[styles.hotelPriceUnit, { color: colors.textSecondary }]}>/nuit</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const RoomCard = ({ room }: { room: Room }) => (
    <TouchableOpacity
      style={[
        styles.roomCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        selectedRoom?.id === room.id && { borderColor: colors.primary, borderWidth: 2 }
      ]}
      onPress={() => handleRoomSelect(room)}
    >
      <Image source={{ uri: room.images[0] }} style={styles.roomImage} />
      <View style={styles.roomInfo}>
        <View style={styles.roomHeader}>
          <Text style={[styles.roomType, { color: colors.text }]}>{room.type}</Text>
          <View style={styles.roomCapacity}>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.roomCapacityText, { color: colors.textSecondary }]}>
              {room.capacity} pers
            </Text>
          </View>
        </View>
        <Text style={[styles.roomBedType, { color: colors.textSecondary }]}>{room.bedType}</Text>
        <View style={styles.roomAmenities}>
          {room.amenities.slice(0, 4).map((amenity, index) => (
            <View key={index} style={styles.roomAmenityTag}>
              <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
              <Text style={[styles.roomAmenityText, { color: colors.textSecondary }]}>{amenity}</Text>
            </View>
          ))}
        </View>
        <View style={styles.roomFooter}>
          <View>
            <Text style={[styles.roomPrice, { color: colors.primary }]}>
              {room.price.toLocaleString()} Ar
            </Text>
            <Text style={[styles.roomPriceUnit, { color: colors.textSecondary }]}>/nuit</Text>
          </View>
          <View style={[styles.roomAvailability, { backgroundColor: room.available > 0 ? '#3b82f620' : '#ef444420' }]}>
            <Text style={[styles.roomAvailabilityText, { color: room.available > 0 ? '#3b82f6' : '#ef4444' }]}>
              {room.available > 0 ? `${room.available} disponibles` : 'Complet'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.searchHeader}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher un hôtel..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedCity === '' && styles.filterChipActive]}
            onPress={() => setSelectedCity('')}
          >
            <Text style={[styles.filterChipText, selectedCity === '' && styles.filterChipTextActive]}>
              Tous
            </Text>
          </TouchableOpacity>
          {['Antananarivo', 'Antsirabe', 'Nosy Be', 'Fianarantsoa', 'Antsiranana'].map(city => (
            <TouchableOpacity
              key={city}
              style={[styles.filterChip, selectedCity === city && styles.filterChipActive]}
              onPress={() => setSelectedCity(city)}
            >
              <Text style={[styles.filterChipText, selectedCity === city && styles.filterChipTextActive]}>
                {city}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ratingRow}>
          {[0, 3, 3.5, 4, 4.5, 5].map(rating => (
            <TouchableOpacity
              key={rating}
              style={[styles.ratingChip, selectedRating === rating && styles.ratingChipActive]}
              onPress={() => setSelectedRating(rating)}
            >
              {rating > 0 ? (
                <>
                  <Ionicons name="star" size={14} color={selectedRating === rating ? '#fff' : '#fbbf24'} />
                  <Text style={[styles.ratingChipText, selectedRating === rating && styles.ratingChipTextActive]}>
                    {rating}+
                  </Text>
                </>
              ) : (
                <Text style={[styles.ratingChipText, selectedRating === rating && styles.ratingChipTextActive]}>
                  Tous
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredHotels}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <HotelCard hotel={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.hotelsList}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Choisissez votre chambre
        </Text>
      </View>

      <View style={[styles.hotelInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image source={{ uri: selectedHotel?.images[0] }} style={styles.hotelInfoImage} />
        <View style={styles.hotelInfoContent}>
          <Text style={[styles.hotelInfoName, { color: colors.text }]}>{selectedHotel?.name}</Text>
          <View style={styles.hotelInfoLocation}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.hotelInfoLocationText, { color: colors.textSecondary }]}>
              {selectedHotel?.location}
            </Text>
          </View>
          <View style={styles.hotelInfoRating}>
            <Ionicons name="star" size={14} color="#fbbf24" />
            <Text style={[styles.hotelInfoRatingText, { color: colors.text }]}>{selectedHotel?.rating}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <RoomCard room={item} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={() => setStep(2)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Détails de la réservation
        </Text>
      </View>

      <ScrollView>
        <View style={[styles.bookingDetailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Dates</Text>
          
          <TouchableOpacity
            style={[styles.datePicker, { borderColor: colors.border }]}
            onPress={() => setShowCheckInPicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <View>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Arrivée</Text>
              <Text style={[styles.dateValue, { color: colors.text }]}>
                {checkInDate.toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <Text style={[styles.dateTime, { color: colors.textSecondary }]}>
              Dès {selectedHotel?.checkIn}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePicker, { borderColor: colors.border }]}
            onPress={() => setShowCheckOutPicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <View>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Départ</Text>
              <Text style={[styles.dateValue, { color: colors.text }]}>
                {checkOutDate.toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <Text style={[styles.dateTime, { color: colors.textSecondary }]}>
              Avant {selectedHotel?.checkOut}
            </Text>
          </TouchableOpacity>

          <View style={styles.nightsInfo}>
            <Ionicons name="moon-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.nightsText, { color: colors.textSecondary }]}>
              {Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24))} nuits
            </Text>
          </View>
        </View>

        <View style={[styles.bookingDetailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Voyageurs</Text>
          
          <TouchableOpacity
            style={[styles.guestSelector, { borderColor: colors.border }]}
            onPress={() => setShowGuestsModal(true)}
          >
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={[styles.guestSelectorText, { color: colors.text }]}>
              {guests} voyageur{guests > 1 ? 's' : ''}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.bookingDetailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Demandes spéciales</Text>
          
          <TextInput
            style={[styles.specialRequestsInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Ex: besoin d'un lit bébé, chambre silencieuse..."
            placeholderTextColor={colors.textSecondary}
            value={specialRequests}
            onChangeText={setSpecialRequests}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={[styles.priceBreakdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Détail du prix</Text>
          
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
              {selectedRoom?.type} × {Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24))} nuits
            </Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>
              {(selectedRoom?.price || 0).toLocaleString()} Ar
            </Text>
          </View>
          
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Taxes et frais</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>
              {(calculateTotalPrice() * 0.1).toLocaleString()} Ar
            </Text>
          </View>
          
          <View style={styles.priceDivider} />
          
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {(calculateTotalPrice() * 1.1).toLocaleString()} Ar
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.bookButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowPaymentModal(true)}
        >
          <Ionicons name="calendar" size={20} color="#fff" />
          <Text style={styles.bookButtonText}>Réserver maintenant</Text>
        </TouchableOpacity>
      </ScrollView>

      {showCheckInPicker && (
        <DateTimePicker
          value={checkInDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowCheckInPicker(false);
            if (date && date < checkOutDate) {
              setCheckInDate(date);
            }
          }}
          minimumDate={new Date()}
        />
      )}

      {showCheckOutPicker && (
        <DateTimePicker
          value={checkOutDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowCheckOutPicker(false);
            if (date && date > checkInDate) {
              setCheckOutDate(date);
            }
          }}
          minimumDate={new Date(checkInDate.getTime() + 86400000)}
        />
      )}
    </View>
  );

  const renderGuestsModal = () => (
    <Modal
      visible={showGuestsModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.guestsModal, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nombre de voyageurs</Text>
            <TouchableOpacity onPress={() => setShowGuestsModal(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.guestCounter}>
            <Text style={[styles.guestCounterLabel, { color: colors.text }]}>Adultes</Text>
            <View style={styles.counterControls}>
              <TouchableOpacity
                style={[styles.counterButton, { borderColor: colors.border }]}
                onPress={() => setGuests(Math.max(1, guests - 1))}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.counterValue, { color: colors.text }]}>{guests}</Text>
              <TouchableOpacity
                style={[styles.counterButton, { borderColor: colors.border }]}
                onPress={() => setGuests(Math.min(10, guests + 1))}
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmGuestButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowGuestsModal(false)}
          >
            <Text style={styles.confirmGuestButtonText}>Confirmer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
              {(calculateTotalPrice() * 1.1).toLocaleString()} Ar
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

  const renderTicketModal = () => (
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
                <Ionicons name="bed-outline" size={40} color={colors.primary} />
                <Text style={[styles.ticketTitle, { color: colors.text }]}>Voucher Hôtel</Text>
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
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Hôtel</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text, fontWeight: 'bold' }]}>
                    {booking?.hotel.name}
                  </Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Adresse</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.hotel.location}</Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Chambre</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.room.type}</Text>
                </View>
                
                <View style={styles.ticketDivider} />
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Client</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.guestName}</Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Téléphone</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.guestPhone}</Text>
                </View>
                
                <View style={styles.ticketDivider} />
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Arrivée</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                    {booking?.checkInDate.toLocaleDateString('fr-FR')} (dès {booking?.hotel.checkIn})
                  </Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Départ</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>
                    {booking?.checkOutDate.toLocaleDateString('fr-FR')} (avant {booking?.hotel.checkOut})
                  </Text>
                </View>
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Voyageurs</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{booking?.guests} personne(s)</Text>
                </View>
                
                <View style={styles.ticketDivider} />
                
                <View style={styles.ticketInfoRow}>
                  <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary, fontSize: 16 }]}>Total payé</Text>
                  <Text style={[styles.ticketInfoValue, { color: colors.primary, fontSize: 20, fontWeight: 'bold' }]}>
                    {booking?.totalPrice.toLocaleString()} Ar
                  </Text>
                </View>

                {specialRequests && (
                  <>
                    <View style={styles.ticketDivider} />
                    <View style={styles.ticketInfoRow}>
                      <Text style={[styles.ticketInfoLabel, { color: colors.textSecondary }]}>Demandes spéciales</Text>
                      <Text style={[styles.ticketInfoValue, { color: colors.text }]}>{specialRequests}</Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.ticketFooter}>
                <Text style={[styles.ticketNote, { color: colors.textSecondary }]}>
                  Présentez ce voucher à l'accueil de l'hôtel
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Réservation Hôtel</Text>
          <View style={{ width: 40 }} />
        </View>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {renderGuestsModal()}
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
  searchHeader: {
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 14,
    color: '#fff',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  ratingRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#334155',
    gap: 4,
  },
  ratingChipActive: {
    backgroundColor: '#3b82f6',
  },
  ratingChipText: {
    fontSize: 12,
    color: '#fff',
  },
  ratingChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  hotelsList: {
    paddingBottom: 20,
  },
  hotelCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  hotelImage: {
    width: '100%',
    height: 200,
  },
  hotelOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  hotelRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  hotelInfo: {
    padding: 12,
  },
  hotelName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  hotelLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  hotelLocationText: {
    fontSize: 12,
  },
  hotelAmenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  amenityTag: {
    backgroundColor: '#3b82f620',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  amenityTagText: {
    fontSize: 10,
    color: '#3b82f6',
  },
  hotelFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  hotelPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  hotelPriceUnit: {
    fontSize: 12,
    marginLeft: 4,
  },
  hotelInfoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  hotelInfoImage: {
    width: 80,
    height: 80,
  },
  hotelInfoContent: {
    flex: 1,
    padding: 12,
  },
  hotelInfoName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  hotelInfoLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  hotelInfoLocationText: {
    fontSize: 12,
  },
  hotelInfoRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hotelInfoRatingText: {
    fontSize: 12,
  },
  roomCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  roomImage: {
    width: 120,
    height: 120,
  },
  roomInfo: {
    flex: 1,
    padding: 12,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roomType: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  roomCapacity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomCapacityText: {
    fontSize: 12,
  },
  roomBedType: {
    fontSize: 12,
    marginBottom: 8,
  },
  roomAmenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  roomAmenityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomAmenityText: {
    fontSize: 10,
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  roomPriceUnit: {
    fontSize: 10,
  },
  roomAvailability: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roomAvailabilityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  bookingDetailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateTime: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  nightsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 8,
  },
  nightsText: {
    fontSize: 12,
  },
  guestSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  guestSelectorText: {
    fontSize: 14,
    flex: 1,
    marginLeft: 12,
  },
  specialRequestsInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  priceBreakdown: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 14,
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 30,
  },
  bookButtonText: {
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
  guestsModal: {
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
  guestCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  guestCounterLabel: {
    fontSize: 16,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  confirmGuestButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmGuestButtonText: {
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