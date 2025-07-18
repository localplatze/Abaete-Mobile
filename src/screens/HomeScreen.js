// src/screens/HomeScreen.js (Paciente/Responsável) - VERSÃO REFINADA
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons'; // Ou seus ícones de marca
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';

// Dados Estáticos (Simulação) - Mantidos como antes
const pacienteData = {
  nome: 'Ana Silva',
  proximosEventos: [
    { id: '1', data: '25/07', hora: '10:00', tipo: 'Sessão de Fono', profissional: 'Dr. Carlos' },
    { id: '2', data: '27/07', hora: '14:30', tipo: 'Terapia Ocupacional', profissional: 'Dra. Beatriz' },
    { id: '3', data: '28/07', hora: '09:00', tipo: 'Sessão ABA', profissional: 'Dra. Laura' },
  ],
  progressoRecente: { titulo: 'Nova conquista!', detalhe: 'Demonstrou mais iniciativa em atividades sociais esta semana.' },
  tarefasPendentes: [
    { id: 't1', nome: 'Atividade de pintura com os dedos', prazo: 'Hoje' },
  ],
};

const notificacoesData = [
    { id: 'n1', tipo: 'agenda', texto: 'Lembrete: Sessão com Dr. Carlos amanhã às 10:00.', hora: 'Há 20min'},
    { id: 'n2', tipo: 'tarefa', texto: 'Nova tarefa de casa: "Caça ao Tesouro dos Sons".', hora: 'Ontem'},
    { id: 'n3', tipo: 'progresso', texto: 'Dra. Beatriz compartilhou uma nova evolução.', hora: '2 dias atrás'},
];


// --- COMPONENTES DE CONTEÚDO DAS ABAS ---

const HomeContent = ({ navigation }) => (
  <ScrollView
    style={styles.contentScrollViewClean}
    contentContainerStyle={styles.contentContainerClean}
    showsVerticalScrollIndicator={false}
  >
    <Text style={styles.greetingTextClean}>Olá, <Text style={{fontFamily: FONT_FAMILY.Bold}}>{pacienteData.nome}!</Text></Text>
    <Text style={styles.subGreetingText}>Como podemos te ajudar hoje?</Text>

    {/* Card de Próximos Eventos */}
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximos Agendamentos</Text>
        <TouchableOpacity onPress={() => console.log("Ver agenda completa")}>
          <Text style={styles.seeAllText}>Ver Todos</Text>
        </TouchableOpacity>
      </View>
      {pacienteData.proximosEventos.slice(0, 2).map(evento => ( // Mostrar apenas os 2 primeiros
        <TouchableOpacity key={evento.id} style={styles.eventCardClean} onPress={() => console.log("Detalhe Evento", evento.id)}>
          <View style={styles.eventIconContainer}>
            <MaterialIcons name="event" size={24} color={ABAETE_COLORS.primaryBlue} />
          </View>
          <View style={styles.eventDetails}>
            <Text style={styles.eventTitle}>{evento.tipo}</Text>
            <Text style={styles.eventTime}>{evento.data} às {evento.hora} com {evento.profissional}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} />
        </TouchableOpacity>
      ))}
      {pacienteData.proximosEventos.length === 0 && <Text style={styles.emptySectionText}>Nenhum agendamento próximo.</Text>}
    </View>

    {/* Card de Progresso Recente */}
    <View style={styles.sectionContainer}>
       <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Destaques do Progresso</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ProgressoTab')}>
                <Text style={styles.seeAllText}>Ver Detalhes</Text>
            </TouchableOpacity>
        </View>
      <TouchableOpacity style={[styles.infoCardClean, { backgroundColor: ABAETE_COLORS.lightPink }]} onPress={() => navigation.navigate('ProgressoTab')}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={[styles.infoIconContainer, { backgroundColor: 'rgba(244, 143, 177, 0.2)'}]}>
                <MaterialIcons name="star-outline" size={24} color={'#D81B60'} />
            </View>
            <View style={styles.infoTextContainer}>
                <Text style={styles.infoCardTitle}>{pacienteData.progressoRecente.titulo}</Text>
                <Text style={styles.infoCardDetail}>{pacienteData.progressoRecente.detalhe}</Text>
            </View>
        </View>
      </TouchableOpacity>
    </View>

    {/* Card de Tarefas Pendentes */}
    {pacienteData.tarefasPendentes.length > 0 && (
      <View style={styles.sectionContainer}>
         <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Atividades para Casa</Text>
             <TouchableOpacity onPress={() => navigation.navigate('TarefasTab')}>
                <Text style={styles.seeAllText}>Ver Todas</Text>
            </TouchableOpacity>
        </View>
        {pacienteData.tarefasPendentes.map(tarefa => (
          <TouchableOpacity key={tarefa.id} style={styles.taskCardClean} onPress={() => console.log("Detalhe Tarefa", tarefa.id)}>
            <View style={[styles.infoIconContainer, { backgroundColor: 'rgba(255, 222, 128, 0.3)'}]}>
                 <MaterialIcons name="home-work" size={24} color={ABAETE_COLORS.yellowDark} />
            </View>
            <View style={styles.infoTextContainer}>
                <Text style={styles.infoCardTitle}>{tarefa.nome}</Text>
                <Text style={styles.infoCardDetail}>Prazo: {tarefa.prazo}</Text>
            </View>
             <View style={styles.taskStatusIndicator} />
          </TouchableOpacity>
        ))}
      </View>
    )}
    {/* Espaço extra no final */}
    <View style={{ height: 20 }} />
  </ScrollView>
);

const ProgressoContent = ({ navigation }) => (
  <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
    <Text style={styles.pageTitleClean}>Acompanhamento</Text>
    <View style={styles.infoCardClean}>
      <Text style={styles.sectionTitleClean}>Evolução em Comunicação</Text>
      <Text style={styles.cardTextClean}>Gráfico mostrando melhora nos últimos 3 meses...</Text>
      <Image source={{uri: 'https://img.freepik.com/vetores-gratis/ilustracao-do-grafico-de-analise-de-dados_53876-17902.jpg?semt=ais_hybrid&w=740'}} style={styles.placeholderImageClean} />
    </View>
    <TouchableOpacity style={styles.infoCardClean} onPress={() => console.log("Ver detalhes do relatório")}>
      <Text style={styles.sectionTitleClean}>Relatório da Sessão - 20/07</Text>
      <Text style={styles.cardTextClean}>Foco em interação social e atividades motoras. Clique para ver detalhes.</Text>
    </TouchableOpacity>
  </ScrollView>
);

const TarefasContent = ({ navigation }) => (
 <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
    <Text style={styles.pageTitleClean}>Minhas Tarefas</Text>
    {[{id:1, nome: 'Leitura divertida', status: 'Pendente', profissional: 'Dra. Laura'}, {id:2, nome: 'Jogo da memória das emoções', status: 'Concluída', profissional: 'Dr. Carlos'}].map(tarefa => (
        <TouchableOpacity key={tarefa.id} style={styles.listItemClean} onPress={() => console.log("Detalhes da tarefa", tarefa.id)}>
            <View style={[styles.listItemIconContainer, tarefa.status === 'Pendente' ? {backgroundColor: ABAETE_COLORS.yellowOpaco} : {backgroundColor: '#E8F5E9'}]}>
                <MaterialIcons name={tarefa.status === 'Pendente' ? "pending-actions" : "check-circle-outline"} size={24} color={tarefa.status === 'Pendente' ? ABAETE_COLORS.yellowDark : ABAETE_COLORS.successGreen} />
            </View>
            <View style={styles.listItemTextContainer}>
                <Text style={styles.listItemTitle}>{tarefa.nome}</Text>
                <Text style={styles.listItemSubtitle}>Atribuído por: {tarefa.profissional}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} />
        </TouchableOpacity>
    ))}
  </ScrollView>
);

const NotificacoesContent = ({ navigation }) => (
  <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
    <Text style={styles.pageTitleClean}>Notificações</Text>
    {notificacoesData.map(notif => (
        <TouchableOpacity key={notif.id} style={styles.listItemClean} onPress={() => console.log("Abrir notif", notif.id)}>
            <View style={[styles.listItemIconContainer, {backgroundColor: ABAETE_COLORS.lightPink}]}>
                <MaterialIcons
                    name={
                        notif.tipo === 'agenda' ? 'event-available' :
                        notif.tipo === 'tarefa' ? 'assignment-late' :
                        notif.tipo === 'progresso' ? 'insights' : 'notifications-active'
                    }
                    size={24}
                    color={ABAETE_COLORS.primaryBlue} />
            </View>
            <View style={styles.listItemTextContainer}>
                <Text style={styles.listItemTitle}>{notif.texto}</Text>
                <Text style={styles.listItemSubtitle}>{notif.hora}</Text>
            </View>
             {/* <View style={styles.unreadDotClean} /> Opicional */}
        </TouchableOpacity>
    ))}
    {notificacoesData.length === 0 && <Text style={styles.emptySectionText}>Nenhuma notificação nova.</Text>}
  </ScrollView>
);

const PerfilContent = ({ navigation }) => (
  <ScrollView style={styles.contentScrollViewClean} contentContainerStyle={styles.contentContainerClean}>
    <View style={styles.profileHeaderClean}>
        <Image source={{uri: 'https://via.placeholder.com/100?text=AS'}} style={styles.profileImageClean} />
        <Text style={styles.profileNameClean}>{pacienteData.nome}</Text>
        <Text style={styles.profileEmailClean}>ana.silva@example.com</Text>
    </View>
    {[
        {label: 'Editar Perfil', icon: 'edit', action: () => console.log('Editar Perfil')},
        {label: 'Configurações de Notificações', icon: 'notifications', action: () => console.log('Config Notif')},
        {label: 'Termos e Privacidade', icon: 'gavel', action: () => console.log('Termos')},
        {label: 'Ajuda & Suporte', icon: 'help-outline', action: () => console.log('Ajuda')},
    ].map(item => (
        <TouchableOpacity key={item.label} style={styles.profileMenuItemClean} onPress={item.action}>
            <MaterialIcons name={item.icon} size={24} color={ABAETE_COLORS.secondaryBlue} style={styles.profileMenuIcon} />
            <Text style={styles.profileMenuItemTextClean}>{item.label}</Text>
            <MaterialIcons name="chevron-right" size={24} color={ABAETE_COLORS.mediumGray} />
        </TouchableOpacity>
    ))}
    <TouchableOpacity style={[styles.profileMenuItemClean, {marginTop: 20}]} onPress={() => navigation.replace('Login')}>
        <MaterialIcons name="logout" size={24} color={ABAETE_COLORS.errorRed} style={styles.profileMenuIcon} />
        <Text style={[styles.profileMenuItemTextClean, {color: ABAETE_COLORS.errorRed}]}>Sair</Text>
    </TouchableOpacity>
  </ScrollView>
);


// --- Componente Principal HomeScreen (Paciente/Responsável) ---
export const HomeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Home');

  const renderContent = () => {
    // Navegação para as abas pode ser feita aqui também, se o BottomNav for customizado
    // e não parte do react-navigation BottomTabNavigator
    if (activeTab === 'ProgressoTab') return <ProgressoContent navigation={navigation} />;
    if (activeTab === 'TarefasTab') return <TarefasContent navigation={navigation} />;

    switch (activeTab) {
      case 'Home':
        return <HomeContent navigation={navigation} />;
      case 'Progresso':
        return <ProgressoContent navigation={navigation} />;
      case 'Tarefas':
        return <TarefasContent navigation={navigation} />;
      case 'Notificações':
        return <NotificacoesContent navigation={navigation} />;
      case 'Perfil':
        return <PerfilContent navigation={navigation} />;
      default:
        return <HomeContent navigation={navigation} />;
    }
  };

  const tabs = [
    { name: 'Home', icon: 'home-filled', label: 'Início' }, // Usando ícones "filled" para a aba ativa
    { name: 'Progresso', icon: 'leaderboard', label: 'Progresso' },
    { name: 'Tarefas', icon: 'checklist', label: 'Tarefas' },
    { name: 'Notificações', icon: 'notifications', label: 'Alertas' }, // 'notifications-active' para ativa
    { name: 'Perfil', icon: 'account-circle', label: 'Perfil' },
  ];

  return (
    <SafeAreaView style={styles.safeAreaClean}>
      <StatusBar style="dark" backgroundColor={ABAETE_COLORS.white} /> 
      {/* Status bar clara para fundo claro */}
      <View style={styles.headerClean}>
        <Image source={require('../../assets/images/abaete_logo_hor.png')} style={styles.headerLogoClean} resizeMode="contain" />
        {/* Opção de adicionar um ícone de sino para notificações aqui se não estiver no bottomNav */}
        {/* <TouchableOpacity onPress={() => setActiveTab('Notificações')}>
             <MaterialIcons name="notifications-none" size={28} color={ABAETE_COLORS.primaryBlue} />
        </TouchableOpacity> */}
      </View>
      <View style={styles.contentAreaClean}>{renderContent()}</View>
      <View style={styles.bottomNavClean}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={styles.navItemClean}
            onPress={() => setActiveTab(tab.name)}
          >
            <MaterialIcons
              name={activeTab === tab.name ? tab.icon : `${tab.icon.replace('-filled','').replace('-active','')}${tab.icon.includes('account-circle') || tab.icon.includes('leaderboard') || tab.icon.includes('checklist') || tab.icon.includes('home') || tab.icon.includes('notifications') ? '' : '-outline'}` } // Lógica para alternar filled/outline
              size={28} // Ícones um pouco maiores
              color={activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray}
            />
            <Text
              style={[
                styles.navItemTextClean,
                { color: activeTab === tab.name ? ABAETE_COLORS.primaryBlue : ABAETE_COLORS.mediumGray,
                  fontFamily: activeTab === tab.name ? FONT_FAMILY.SemiBold : FONT_FAMILY.Regular,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};


// --- ESTILOS REFINADOS ---
const styles = StyleSheet.create({
  safeAreaClean: {
    flex: 1,
    backgroundColor: ABAETE_COLORS.white, // Fundo principal branco para mais leveza
  },
  headerClean: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Para alinhar logo e possível ícone
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 15, // Ajuste para status bar
    paddingBottom: 10,
    backgroundColor: ABAETE_COLORS.white, // Header branco
    borderBottomWidth: 1,
    borderBottomColor: ABAETE_COLORS.lightGray, // Linha sutil
  },
  headerLogoClean: {
    height: 38,
    width: 130,
  },
  contentAreaClean: {
    flex: 1,
  },
  contentScrollViewClean: {
    backgroundColor: ABAETE_COLORS.white, // Fundo do conteúdo branco
  },
  contentContainerClean: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10, // Menor padding no bottom, o Nav já tem altura
  },
  greetingTextClean: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 24,
    color: ABAETE_COLORS.textPrimary,
    marginBottom: 5,
  },
  subGreetingText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 16,
    color: ABAETE_COLORS.textSecondary,
    marginBottom: 25,
  },
  sectionContainer: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 18,
    color: ABAETE_COLORS.textPrimary,
  },
  pageTitleClean: { // Para títulos de página nas outras abas
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 26,
    color: ABAETE_COLORS.textPrimary,
    marginBottom: 25,
  },
  seeAllText: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 14,
    color: ABAETE_COLORS.primaryBlue,
  },
  eventCardClean: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ABAETE_COLORS.lightPink, // Rosa bem claro para eventos
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ABAETE_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 15,
    color: ABAETE_COLORS.textPrimary,
  },
  eventTime: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 13,
    color: ABAETE_COLORS.textSecondary,
    marginTop: 2,
  },
  infoCardClean: {
    backgroundColor: ABAETE_COLORS.white,
    borderRadius: 12,
    padding: 15,
    // marginBottom: 12, // Removido, sectionContainer já tem margin
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray, // Borda sutil em vez de sombra forte
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoCardTitle: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 15,
    color: ABAETE_COLORS.textPrimary,
    marginBottom: 3,
  },
  infoCardDetail: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 14,
    color: ABAETE_COLORS.textSecondary,
    lineHeight: 20,
  },
  taskCardClean: { // Similar ao infoCard, mas pode ter variações
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ABAETE_COLORS.white,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: ABAETE_COLORS.lightGray,
  },
  taskStatusIndicator: { // Um pequeno indicador visual para tarefas
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ABAETE_COLORS.yellow, // Amarelo para pendente
    marginLeft: 10,
  },
  emptySectionText: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 15,
    color: ABAETE_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    paddingVertical: 20,
  },
  placeholderImageClean: {
      width: '100%',
      height: 160,
      borderRadius: 10,
      backgroundColor: ABAETE_COLORS.lightGray,
      marginVertical: 10,
  },
  cardTextClean: { // Texto dentro de cards de progresso/etc
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 15,
    color: ABAETE_COLORS.textSecondary,
    lineHeight: 22,
    marginTop: 8,
  },
  sectionTitleClean: { // Título dentro de um card, como em Progresso
    fontFamily: FONT_FAMILY.Bold,
    fontSize: 17,
    color: ABAETE_COLORS.textPrimary,
  },
  // Estilos para listas (Tarefas, Notificações)
  listItemClean: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: ABAETE_COLORS.lightGray,
  },
  listItemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10, // Pode ser menos circular
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  listItemTextContainer: {
    flex: 1,
  },
  listItemTitle: {
    fontFamily: FONT_FAMILY.SemiBold,
    fontSize: 15,
    color: ABAETE_COLORS.textPrimary,
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 13,
    color: ABAETE_COLORS.textSecondary,
  },
//   unreadDotClean: { // Similar ao anterior mas para novo estilo
//       width: 10,
//       height: 10,
//       borderRadius: 5,
//       backgroundColor: ABAETE_COLORS.primaryBlue, // Ou amarelo para destaque
//       marginLeft: 'auto', // Empurra para a direita
//   },
  // Estilos do Perfil
  profileHeaderClean: {
      alignItems: 'center',
      paddingVertical: 25,
      marginBottom: 20,
      // backgroundColor: ABAETE_COLORS.lightPink, // Pode remover para ser mais clean
      // borderRadius: 12,
  },
  profileImageClean: {
      width: 110,
      height: 110,
      borderRadius: 55,
      marginBottom: 12,
      borderWidth: 3,
      borderColor: ABAETE_COLORS.primaryBlue, // Destaque na borda
  },
  profileNameClean: {
      fontFamily: FONT_FAMILY.Bold,
      fontSize: 22,
      color: ABAETE_COLORS.textPrimary,
  },
  profileEmailClean: {
      fontFamily: FONT_FAMILY.Regular,
      fontSize: 15,
      color: ABAETE_COLORS.textSecondary,
      marginTop: 4,
  },
  profileMenuItemClean: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16, // Mais espaçamento vertical
      borderBottomWidth: 1,
      borderBottomColor: ABAETE_COLORS.lightGray,
  },
  profileMenuIcon: {
      marginRight: 15,
  },
  profileMenuItemTextClean: {
      fontFamily: FONT_FAMILY.SemiBold,
      fontSize: 16,
      color: ABAETE_COLORS.textPrimary,
      flex: 1, // Para ocupar espaço e empurrar chevron
  },
  // Bottom Navigation Refinado
  bottomNavClean: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 80 : 70, // Mais alto, especialmente para iOS com safe area
    paddingBottom: Platform.OS === 'ios' ? 15 : 0, // Padding para safe area no iOS
    backgroundColor: ABAETE_COLORS.white, // Fundo branco
    borderTopWidth: 1,
    borderTopColor: ABAETE_COLORS.lightGray, // Linha sutil
    alignItems: 'flex-start', // Alinha itens no topo para dar espaço ao texto abaixo do ícone
  },
  navItemClean: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // Centraliza verticalmente ícone e texto
    paddingTop: 10, // Espaço no topo do item
  },
  navItemTextClean: {
    fontFamily: FONT_FAMILY.Regular,
    fontSize: 10, // Texto menor para um look mais clean
    marginTop: 4, // Espaço entre ícone e texto
  },
  // Cores adicionais para o design clean
  yellowOpaco: {
    backgroundColor: 'rgba(255, 222, 128, 0.2)', // Amarelo com opacidade para fundos
  },
  yellowDark: {
      color: '#FFA000', // Um tom de amarelo/laranja mais escuro para ícones
  },
  successGreen: {
      color: '#388E3C',
  }
});