import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, View, Text, TextInput, Platform,
    TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ref, get, set } from 'firebase/database';
import { FIREBASE_DB, FIREBASE_AUTH } from '../services/firebaseConnection';
import { ABAETE_COLORS } from '../constants/Colors';
import { FONT_FAMILY } from '../constants/Fonts';
import { Picker } from '@react-native-picker/picker';

const genderMap = {
    male: 'Masculino',
    female: 'Feminino',
    other: 'Outro',
    prefer_not_say: 'Prefiro não informar'
};

const SectionTitle = ({ title }) => <Text style={styles.sectionTitle}>{title}</Text>;

const Input = ({ label, value, onChange, placeholder, keyboardType = 'default', editable = true }) => (
    <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}</Text>
        <TextInput 
            style={[styles.input, !editable && styles.inputDisabled]} 
            value={value} 
            onChangeText={onChange} 
            placeholder={placeholder} 
            keyboardType={keyboardType}
            editable={editable}
        />
    </View>
);

const YesNoQuestion = ({ question, value, onValueChange }) => (
    <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{question}</Text>
        <View style={styles.switchContainer}>
            <TouchableOpacity onPress={() => onValueChange(true)} style={[styles.switchButton, value === true && styles.switchActive]}>
                <Text style={[styles.switchText, value === true && styles.switchTextActive]}>Sim</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onValueChange(false)} style={[styles.switchButton, value === false && styles.switchActive]}>
                <Text style={[styles.switchText, value === false && styles.switchTextActive]}>Não</Text>
            </TouchableOpacity>
        </View>
    </View>
);

const PickerQuestion = ({ label, selectedValue, onValueChange, items }) => (
    <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedValue} onValueChange={onValueChange}>
                {items.map(item => <Picker.Item key={item.value} label={item.label} value={item.value} />)}
            </Picker>
        </View>
    </View>
);

const MedicalVisitBlock = ({ specialist, section, fieldPrefix, formData, onUpdate }) => (
    <View style={styles.specialistBlock}>
        <Text style={styles.specialistTitle}>{specialist}</Text>
        <Input label="Com que frequência?" value={formData[section]?.[`${fieldPrefix}Frequencia`]} onChange={v => onUpdate(section, `${fieldPrefix}Frequencia`, v)} />
        <Input label="Qual foi a última vez?" value={formData[section]?.[`${fieldPrefix}UltimaVez`]} onChange={v => onUpdate(section, `${fieldPrefix}UltimaVez`, v)} />
        <Input label="Quem foi com ele(a)?" value={formData[section]?.[`${fieldPrefix}Companhia`]} onChange={v => onUpdate(section, `${fieldPrefix}Companhia`, v)} />
        <Input label="Como ele(a) se comporta no consultório?" value={formData[section]?.[`${fieldPrefix}Comportamento`]} onChange={v => onUpdate(section, `${fieldPrefix}Comportamento`, v)} />
    </View>
);

const CheckboxGroup = ({ label, options, selectedOptions = [], onSelectionChange }) => {
    const handleToggle = (optionValue) => {
        const newSelection = selectedOptions.includes(optionValue)
            ? selectedOptions.filter(item => item !== optionValue)
            : [...selectedOptions, optionValue];
        onSelectionChange(newSelection);
    };

    return (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.checkboxContainer}>
                {options.map(option => (
                    <TouchableOpacity
                        key={option.value}
                        style={styles.checkboxItem}
                        onPress={() => handleToggle(option.value)}
                    >
                        <MaterialIcons
                            name={selectedOptions.includes(option.value) ? 'check-box' : 'check-box-outline-blank'}
                            size={24}
                            color={ABAETE_COLORS.primaryBlue}
                        />
                        <Text style={styles.checkboxLabel}>{option.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const FamilyMemberRow = ({ member, index, onUpdate, onRemove }) => (
    <View style={styles.tableRow}>
        <TextInput style={[styles.tableInput, {flex: 3}]} placeholder="Nome" value={member.nome} onChangeText={v => onUpdate(index, 'nome', v)} />
        <TextInput style={[styles.tableInput, {flex: 1}]} placeholder="Idade" value={member.idade} onChangeText={v => onUpdate(index, 'idade', v)} keyboardType="numeric" />
        <TextInput style={[styles.tableInput, {flex: 2}]} placeholder="Parentesco" value={member.parentesco} onChangeText={v => onUpdate(index, 'parentesco', v)} />
        <TextInput style={[styles.tableInput, {flex: 2}]} placeholder="Escolaridade" value={member.escolaridade} onChangeText={v => onUpdate(index, 'escolaridade', v)} />
        <TouchableOpacity onPress={() => onRemove(index)} style={styles.removeRowBtn}>
            <MaterialIcons name="delete-outline" size={22} color={ABAETE_COLORS.errorRed} />
        </TouchableOpacity>
    </View>
);

export const AnamneseScreen = ({ route, navigation }) => {
    const { patient } = route.params;
    const [formData, setFormData] = useState({
        identificacao: {},
        historiaPessoal: {},
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            identificacao: {
                ...prev.identificacao,
                nome: patient.fullName,
                dataNascimento: patient.birthday,
                sexo: genderMap[patient.gender] || patient.gender,
            }
        }));
        setLoading(false);
    }, [patient]);
    
    const handleUpdate = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: { ...(prev[section] || {}), [field]: value }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const anamneseRef = ref(FIREBASE_DB, `anamnesis/${patient.id}`);
            await set(anamneseRef, {
                ...formData,
                patientId: patient.id,
                completedAt: new Date().toISOString(),
                completedBy: FIREBASE_AUTH.currentUser.uid,
            });
            Alert.alert("Sucesso", "Formulário de Anamnese salvo com sucesso!", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error("Erro ao salvar anamnese:", error);
            Alert.alert("Erro", "Não foi possível salvar o formulário.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={26} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Anamnese do Paciente</Text>
                <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                
                {/* --- SEÇÃO I: IDENTIFICAÇÃO --- */}
                <SectionTitle title="I - Identificação" />
                <Input label="Nome" value={formData.identificacao?.nome} editable={false} />
                <Input label="Data de Nascimento" value={formData.identificacao?.dataNascimento} editable={false} />
                <Input label="Sexo" value={formData.identificacao?.sexo} editable={false} />
                <Input label="Etnia" value={formData.identificacao?.etnia} onChange={v => handleUpdate('identificacao', 'etnia', v)} />
                <Input label="Escolaridade" value={formData.identificacao?.escolaridade} onChange={v => handleUpdate('identificacao', 'escolaridade', v)} />
                <Input label="Nome do Pai" value={formData.identificacao?.nomePai} onChange={v => handleUpdate('identificacao', 'nomePai', v)} />
                <Input label="Idade do Pai" value={formData.identificacao?.idadePai} onChange={v => handleUpdate('identificacao', 'idadePai', v)} keyboardType="numeric" />
                <Input label="Profissão/Ocupação do Pai" value={formData.identificacao?.profissaoPai} onChange={v => handleUpdate('identificacao', 'profissaoPai', v)} />
                <Input label="Nome da Mãe" value={formData.identificacao?.nomeMae} onChange={v => handleUpdate('identificacao', 'nomeMae', v)} />
                <Input label="Idade da Mãe" value={formData.identificacao?.idadeMae} onChange={v => handleUpdate('identificacao', 'idadeMae', v)} keyboardType="numeric" />
                <Input label="Profissão/Ocupação da Mãe" value={formData.identificacao?.profissaoMae} onChange={v => handleUpdate('identificacao', 'profissaoMae', v)} />
                <Input label="Endereço" value={formData.identificacao?.endereco} onChange={v => handleUpdate('identificacao', 'endereco', v)} />

                {/* --- SEÇÃO II: HISTÓRIA PESSOAL --- */}
                <SectionTitle title="II – História Pessoal" />
                <Text style={styles.subSectionTitle}>a) Concepção</Text>
                <YesNoQuestion question="Gravidez desejada?" value={formData.historiaPessoal?.gravidezDesejada} onValueChange={v => handleUpdate('historiaPessoal', 'gravidezDesejada', v)} />
                <YesNoQuestion question="Gravidez planejada?" value={formData.historiaPessoal?.gravidezPlanejada} onValueChange={v => handleUpdate('historiaPessoal', 'gravidezPlanejada', v)} />

                <Text style={styles.subSectionTitle}>b) Adoção</Text>
                <YesNoQuestion question="A criança/adolescente é adotado(a)?" value={formData.historiaPessoal?.eAdotado} onValueChange={v => handleUpdate('historiaPessoal', 'eAdotado', v)} />
                {formData.historiaPessoal?.eAdotado && (
                    <View style={styles.dependentField}>
                        <Input label="Com que idade foi adotada?" value={formData.historiaPessoal?.idadeAdocao} onChange={v => handleUpdate('historiaPessoal', 'idadeAdocao', v)} />
                        <YesNoQuestion question="Sabe que é adotado(a)?" value={formData.historiaPessoal?.sabeSerAdotado} onValueChange={v => handleUpdate('historiaPessoal', 'sabeSerAdotado', v)} />
                        <Input label="Qual a reação ao saber da adoção?" value={formData.historiaPessoal?.reacaoAdocao} onChange={v => handleUpdate('historiaPessoal', 'reacaoAdocao', v)} />
                    </View>
                )}

                <Text style={styles.subSectionTitle}>c) Pré-natal e Nascimento</Text>
                <YesNoQuestion question="Realizou exames pré-natais?" value={formData.historiaPessoal?.fezPreNatal} onValueChange={v => handleUpdate('historiaPessoal', 'fezPreNatal', v)} />
                {formData.historiaPessoal?.fezPreNatal && <View style={styles.dependentField}><Input label="Com que frequência?" value={formData.historiaPessoal?.frequenciaPreNatal} onChange={v => handleUpdate('historiaPessoal', 'frequenciaPreNatal', v)} /></View>}
                <YesNoQuestion question="Quedas durante a gravidez?" value={formData.historiaPessoal?.teveQuedas} onValueChange={v => handleUpdate('historiaPessoal', 'teveQuedas', v)} />
                {formData.historiaPessoal?.teveQuedas && <View style={styles.dependentField}><Input label="Como ocorreu?" value={formData.historiaPessoal?.detalhesQuedas} onChange={v => handleUpdate('historiaPessoal', 'detalhesQuedas', v)} /></View>}
                <YesNoQuestion question="Doenças durante a gravidez?" value={formData.historiaPessoal?.teveDoencas} onValueChange={v => handleUpdate('historiaPessoal', 'teveDoencas', v)} />
                {formData.historiaPessoal?.teveDoencas && <View style={styles.dependentField}><Input label="Quais?" value={formData.historiaPessoal?.quaisDoencas} onChange={v => handleUpdate('historiaPessoal', 'quaisDoencas', v)} /></View>}
                <YesNoQuestion question="Internações durante a gravidez?" value={formData.historiaPessoal?.teveInternacoes} onValueChange={v => handleUpdate('historiaPessoal', 'teveInternacoes', v)} />
                <PickerQuestion label="Parto" selectedValue={formData.historiaPessoal?.tipoParto} onValueChange={v => handleUpdate('historiaPessoal', 'tipoParto', v)}
                    items={[ {label: 'Selecione...', value: ''}, {label: 'Cesáreo', value: 'cesareo'}, {label: 'Normal', value: 'normal'}, {label: 'Fórceps', value: 'forceps'} ]}
                />
                <YesNoQuestion question="Houve complicações?" value={formData.historiaPessoal?.complicacoesParto} onValueChange={v => handleUpdate('historiaPessoal', 'complicacoesParto', v)} />
                {formData.historiaPessoal?.complicacoesParto && <View style={styles.dependentField}><Input label="Quais?" value={formData.historiaPessoal?.quaisComplicacoes} onChange={v => handleUpdate('historiaPessoal', 'quaisComplicacoes', v)} /></View>}
                <Input label="Chorou ao nascer?" value={formData.historiaPessoal?.chorouNascer} onChange={v => handleUpdate('historiaPessoal', 'chorouNascer', v)} />

                <Text style={styles.subSectionTitle}>d) Amamentação</Text>
                <YesNoQuestion question="Foi amamentado no peito?" value={formData.historiaPessoal?.amamentouPeito} onValueChange={v => handleUpdate('historiaPessoal', 'amamentouPeito', v)} />
                {formData.historiaPessoal?.amamentouPeito && <View style={styles.dependentField}><Input label="Durante quanto tempo?" value={formData.historiaPessoal?.tempoPeito} onChange={v => handleUpdate('historiaPessoal', 'tempoPeito', v)} /></View>}
                <YesNoQuestion question="Foi amamentado na mamadeira?" value={formData.historiaPessoal?.usouMamadeira} onValueChange={v => handleUpdate('historiaPessoal', 'usouMamadeira', v)} />
                {formData.historiaPessoal?.usouMamadeira && <View style={styles.dependentField}><Input label="Motivo" value={formData.historiaPessoal?.motivoMamadeira} onChange={v => handleUpdate('historiaPessoal', 'motivoMamadeira', v)} /></View>}
                <Input label="Com que idade desmamou?" value={formData.historiaPessoal?.idadeDesmame} onChange={v => handleUpdate('historiaPessoal', 'idadeDesmame', v)} />
                <Input label="Como foi o desmame?" value={formData.historiaPessoal?.comoFoiDesmame} onChange={v => handleUpdate('historiaPessoal', 'comoFoiDesmame', v)} />
                
                {/* --- SEÇÃO III: DESENVOLVIMENTO FÍSICO E MOTOR --- */}
                <SectionTitle title="III - Desenvolvimento Físico e Motor" />
                <Text style={styles.subSectionTitle}>Com que idade (em meses):</Text>
                <Input label="Apareceu o primeiro dente?" value={formData.desenvolvimentoMotor?.primeiroDente} onChange={v => handleUpdate('desenvolvimentoMotor', 'primeiroDente', v)} keyboardType="numeric" />
                <Input label="Balbuciou?" value={formData.desenvolvimentoMotor?.balbuciou} onChange={v => handleUpdate('desenvolvimentoMotor', 'balbuciou', v)} keyboardType="numeric" />
                <Input label="Falou as primeiras palavras?" value={formData.desenvolvimentoMotor?.primeirasPalavras} onChange={v => handleUpdate('desenvolvimentoMotor', 'primeirasPalavras', v)} keyboardType="numeric" />
                <Input label="Sentou?" value={formData.desenvolvimentoMotor?.sentou} onChange={v => handleUpdate('desenvolvimentoMotor', 'sentou', v)} keyboardType="numeric" />
                <Input label="Levantou?" value={formData.desenvolvimentoMotor?.levantou} onChange={v => handleUpdate('desenvolvimentoMotor', 'levantou', v)} keyboardType="numeric" />
                <Input label="Engatinhou?" value={formData.desenvolvimentoMotor?.engatinhou} onChange={v => handleUpdate('desenvolvimentoMotor', 'engatinhou', v)} keyboardType="numeric" />
                <Input label="Caminhou?" value={formData.desenvolvimentoMotor?.caminhou} onChange={v => handleUpdate('desenvolvimentoMotor', 'caminhou', v)} keyboardType="numeric" />
                <Input label="Enurese (urinar involuntariamente)?" value={formData.desenvolvimentoMotor?.enurese} onChange={v => handleUpdate('desenvolvimentoMotor', 'enurese', v)} />
                <Input label="Ecoprese (defecar involuntariamente)?" value={formData.desenvolvimentoMotor?.ecoprese} onChange={v => handleUpdate('desenvolvimentoMotor', 'ecoprese', v)} />


                {/* --- SEÇÃO IV: DESENVOLVIMENTO PSICOSSOCIAL --- */}
                <SectionTitle title="IV - Desenvolvimento Psicossocial" />
                <YesNoQuestion question="Chora com frequência?" value={formData.psicossocial?.choraFrequente} onValueChange={v => handleUpdate('psicossocial', 'choraFrequente', v)} />
                {formData.psicossocial?.choraFrequente && <View style={styles.dependentField}><Input label="Motivo" value={formData.psicossocial?.motivoChoro} onChange={v => handleUpdate('psicossocial', 'motivoChoro', v)} /></View>}

                <YesNoQuestion question="Solicita atenção com frequência?" value={formData.psicossocial?.solicitaAtencao} onValueChange={v => handleUpdate('psicossocial', 'solicitaAtencao', v)} />
                {formData.psicossocial?.solicitaAtencao && <View style={styles.dependentField}><Input label="Motivo" value={formData.psicossocial?.motivoAtencao} onChange={v => handleUpdate('psicossocial', 'motivoAtencao', v)} /></View>}

                <YesNoQuestion question="Apresenta medos com frequência?" value={formData.psicossocial?.temMedos} onValueChange={v => handleUpdate('psicossocial', 'temMedos', v)} />
                {formData.psicossocial?.temMedos && <View style={styles.dependentField}><Input label="Quais?" value={formData.psicossocial?.quaisMedos} onChange={v => handleUpdate('psicossocial', 'quaisMedos', v)} /></View>}

                <YesNoQuestion question="Possui condutas impulsivas (agressão/fuga)?" value={formData.psicossocial?.condutasImpulsivas} onValueChange={v => handleUpdate('psicossocial', 'condutasImpulsivas', v)} />
                {formData.psicossocial?.condutasImpulsivas && <View style={styles.dependentField}><Input label="Relate" value={formData.psicossocial?.relatoImpulsivas} onChange={v => handleUpdate('psicossocial', 'relatoImpulsivas', v)} /></View>}

                <YesNoQuestion question="Dorme rápido?" value={formData.psicossocial?.dormeRapido} onValueChange={v => handleUpdate('psicossocial', 'dormeRapido', v)} />
                {formData.psicossocial?.dormeRapido === false && <View style={styles.dependentField}><Input label="Comente" value={formData.psicossocial?.comentarioDormeRapido} onChange={v => handleUpdate('psicossocial', 'comentarioDormeRapido', v)} /></View>}

                <YesNoQuestion question="Tem sono tranquilo?" value={formData.psicossocial?.sonoTranquilo} onValueChange={v => handleUpdate('psicossocial', 'sonoTranquilo', v)} />
                {formData.psicossocial?.sonoTranquilo === false && <View style={styles.dependentField}><Input label="Comente" value={formData.psicossocial?.comentarioSonoTranquilo} onChange={v => handleUpdate('psicossocial', 'comentarioSonoTranquilo', v)} /></View>}

                <YesNoQuestion question="Dorme com objeto de estimação?" value={formData.psicossocial?.dormeComObjeto} onValueChange={v => handleUpdate('psicossocial', 'dormeComObjeto', v)} />
                {formData.psicossocial?.dormeComObjeto && <View style={styles.dependentField}><Input label="Qual?" value={formData.psicossocial?.qualObjeto} onChange={v => handleUpdate('psicossocial', 'qualObjeto', v)} /></View>}

                <YesNoQuestion question="Usou chupeta?" value={formData.psicossocial?.usouChupeta} onValueChange={v => handleUpdate('psicossocial', 'usouChupeta', v)} />
                {formData.psicossocial?.usouChupeta && <View style={styles.dependentField}><Input label="Até que idade?" value={formData.psicossocial?.idadeChupeta} onChange={v => handleUpdate('psicossocial', 'idadeChupeta', v)} /></View>}

                <YesNoQuestion question="Chupou o dedo?" value={formData.psicossocial?.chupouDedo} onValueChange={v => handleUpdate('psicossocial', 'chupouDedo', v)} />
                {formData.psicossocial?.chupouDedo && <View style={styles.dependentField}><Input label="Até que idade?" value={formData.psicossocial?.idadeDedo} onChange={v => handleUpdate('psicossocial', 'idadeDedo', v)} /></View>}

                <YesNoQuestion question="Apresenta tiques?" value={formData.psicossocial?.temTiques} onValueChange={v => handleUpdate('psicossocial', 'temTiques', v)} />
                {formData.psicossocial?.temTiques && <View style={styles.dependentField}>
                    <Input label="Quais?" value={formData.psicossocial?.quaisTiques} onChange={v => handleUpdate('psicossocial', 'quaisTiques', v)} />
                    <Input label="Em quais situações?" value={formData.psicossocial?.situacoesTiques} onChange={v => handleUpdate('psicossocial', 'situacoesTiques', v)} />
                </View>}

                <Input label="Tem ou teve objetos de estimação?" value={formData.psicossocial?.objetosEstimacao} onChange={v => handleUpdate('psicossocial', 'objetosEstimacao', v)} />
                <YesNoQuestion question="Faz amigos com facilidade?" value={formData.psicossocial?.fazAmigos} onValueChange={v => handleUpdate('psicossocial', 'fazAmigos', v)} />
                <YesNoQuestion question="Brinca sozinho?" value={formData.psicossocial?.brincaSozinho} onValueChange={v => handleUpdate('psicossocial', 'brincaSozinho', v)} />
                <YesNoQuestion question="Brinca com amigos?" value={formData.psicossocial?.brincaAmigos} onValueChange={v => handleUpdate('psicossocial', 'brincaAmigos', v)} />
                <YesNoQuestion question="Gosta de visitas?" value={formData.psicossocial?.gostaVisitas} onValueChange={v => handleUpdate('psicossocial', 'gostaVisitas', v)} />

                <YesNoQuestion question="Brinca com familiares (primos, tios)?" value={formData.psicossocial?.brincaFamiliares} onValueChange={v => handleUpdate('psicossocial', 'brincaFamiliares', v)} />
                {formData.psicossocial?.brincaFamiliares && <View style={styles.dependentField}><Input label="Quem?" value={formData.psicossocial?.quaisFamiliares} onChange={v => handleUpdate('psicossocial', 'quaisFamiliares', v)} /></View>}

                <YesNoQuestion question="É comunicativo?" value={formData.psicossocial?.eComunicativo} onValueChange={v => handleUpdate('psicossocial', 'eComunicativo', v)} />

                <YesNoQuestion question="Brinca na rua?" value={formData.psicossocial?.brincaRua} onValueChange={v => handleUpdate('psicossocial', 'brincaRua', v)} />
                {formData.psicossocial?.brincaRua && <View style={styles.dependentField}>
                    <Input label="Com que frequência?" value={formData.psicossocial?.frequenciaRua} onChange={v => handleUpdate('psicossocial', 'frequenciaRua', v)} />
                    <Input label="Qual foi a última vez?" value={formData.psicossocial?.ultimaVezRua} onChange={v => handleUpdate('psicossocial', 'ultimaVezRua', v)} />
                    <Input label="Quem foi com ele(a)?" value={formData.psicossocial?.companhiaRua} onChange={v => handleUpdate('psicossocial', 'companhiaRua', v)} />
                </View>}

                <YesNoQuestion question="Vai à pracinha?" value={formData.psicossocial?.vaiPracinha} onValueChange={v => handleUpdate('psicossocial', 'vaiPracinha', v)} />
                {formData.psicossocial?.vaiPracinha && <View style={styles.dependentField}>
                    <Input label="Com que frequência?" value={formData.psicossocial?.frequenciaPracinha} onChange={v => handleUpdate('psicossocial', 'frequenciaPracinha', v)} />
                    <Input label="Qual foi a última vez?" value={formData.psicossocial?.ultimaVezPracinha} onChange={v => handleUpdate('psicossocial', 'ultimaVezPracinha', v)} />
                    <Input label="Quem foi com ele(a)?" value={formData.psicossocial?.companhiaPracinha} onChange={v => handleUpdate('psicossocial', 'companhiaPracinha', v)} />
                </View>}

                <YesNoQuestion question="Gosta de passeios?" value={formData.psicossocial?.gostaPasseios} onValueChange={v => handleUpdate('psicossocial', 'gostaPasseios', v)} />
                {formData.psicossocial?.gostaPasseios && <View style={styles.dependentField}>
                    <Input label="Com que frequência?" value={formData.psicossocial?.frequenciaPasseios} onChange={v => handleUpdate('psicossocial', 'frequenciaPasseios', v)} />
                    <Input label="Qual foi a última vez?" value={formData.psicossocial?.ultimaVezPasseios} onChange={v => handleUpdate('psicossocial', 'ultimaVezPasseios', v)} />
                    <Input label="Quem foi com ele(a)?" value={formData.psicossocial?.companhiaPasseios} onChange={v => handleUpdate('psicossocial', 'companhiaPasseios', v)} />
                </View>}

                <YesNoQuestion question="Gosta de festas de aniversário?" value={formData.psicossocial?.gostaFestasAniversario} onValueChange={v => handleUpdate('psicossocial', 'gostaFestasAniversario', v)} />
                {formData.psicossocial?.gostaFestasAniversario && <View style={styles.dependentField}>
                    <Input label="Qual foi a última vez?" value={formData.psicossocial?.ultimaVezFestasAniversario} onChange={v => handleUpdate('psicossocial', 'ultimaVezFestasAniversario', v)} />
                    <Input label="Quem foi com ele(a)?" value={formData.psicossocial?.companhiaFestasAniversario} onChange={v => handleUpdate('psicossocial', 'companhiaFestasAniversario', v)} />
                </View>}

                <YesNoQuestion question="Gosta de festas comemorativas (Carnaval, Natal, etc.)?" value={formData.psicossocial?.gostaFestasComemorativas} onValueChange={v => handleUpdate('psicossocial', 'gostaFestasComemorativas', v)} />
                {formData.psicossocial?.gostaFestasComemorativas && <View style={styles.dependentField}>
                    <Input label="Qual foi a última vez?" value={formData.psicossocial?.ultimaVezFestasComemorativas} onChange={v => handleUpdate('psicossocial', 'ultimaVezFestasComemorativas', v)} />
                    <Input label="Quem foi com ele(a)?" value={formData.psicossocial?.companhiaFestasComemorativas} onChange={v => handleUpdate('psicossocial', 'companhiaFestasComemorativas', v)} />
                </View>}

                <YesNoQuestion question="Vai ao cinema?" value={formData.psicossocial?.vaiCinema} onValueChange={v => handleUpdate('psicossocial', 'vaiCinema', v)} />
                {formData.psicossocial?.vaiCinema && <View style={styles.dependentField}>
                    <Input label="Com que frequência?" value={formData.psicossocial?.frequenciaCinema} onChange={v => handleUpdate('psicossocial', 'frequenciaCinema', v)} />
                    <Input label="Qual foi a última vez?" value={formData.psicossocial?.ultimaVezCinema} onChange={v => handleUpdate('psicossocial', 'ultimaVezCinema', v)} />
                    <Input label="Quem foi com ele(a)?" value={formData.psicossocial?.companhiaCinema} onChange={v => handleUpdate('psicossocial', 'companhiaCinema', v)} />
                </View>}

                <YesNoQuestion question="Assiste TV?" value={formData.psicossocial?.assisteTv} onValueChange={v => handleUpdate('psicossocial', 'assisteTv', v)} />
                {formData.psicossocial?.assisteTv && <View style={styles.dependentField}>
                    <Input label="Quantas horas diárias?" value={formData.psicossocial?.horasTv} onChange={v => handleUpdate('psicossocial', 'horasTv', v)} />
                    <Input label="Que filmes costuma assistir?" value={formData.psicossocial?.filmesTv} onChange={v => handleUpdate('psicossocial', 'filmesTv', v)} />
                    <Input label="Que séries ou desenhos costuma assistir?" value={formData.psicossocial?.seriesTv} onChange={v => handleUpdate('psicossocial', 'seriesTv', v)} />
                </View>}

                <YesNoQuestion question="Acessa a internet?" value={formData.psicossocial?.acessaInternet} onValueChange={v => handleUpdate('psicossocial', 'acessaInternet', v)} />
                {formData.psicossocial?.acessaInternet && <View style={styles.dependentField}><Input label="Quantas horas diárias?" value={formData.psicossocial?.horasInternet} onChange={v => handleUpdate('psicossocial', 'horasInternet', v)} /></View>}

                <YesNoQuestion question="É cuidadoso com seus objetos?" value={formData.psicossocial?.cuidadosoObjetos} onValueChange={v => handleUpdate('psicossocial', 'cuidadosoObjetos', v)} />
                {formData.psicossocial?.cuidadosoObjetos === false && <View style={styles.dependentField}><Input label="Comente" value={formData.psicossocial?.comentarioObjetos} onChange={v => handleUpdate('psicossocial', 'comentarioObjetos', v)} /></View>}

                <YesNoQuestion question="Nas brincadeiras costuma liderar?" value={formData.psicossocial?.lideraBrincadeiras} onValueChange={v => handleUpdate('psicossocial', 'lideraBrincadeiras', v)} />
                {formData.psicossocial?.lideraBrincadeiras && <View style={styles.dependentField}><Input label="Reações" value={formData.psicossocial?.reacoesLiderar} onChange={v => handleUpdate('psicossocial', 'reacoesLiderar', v)} /></View>}

                <YesNoQuestion question="Aceita ser comandado?" value={formData.psicossocial?.aceitaComando} onValueChange={v => handleUpdate('psicossocial', 'aceitaComando', v)} />
                {formData.psicossocial?.aceitaComando === false && <View style={styles.dependentField}><Input label="Reações" value={formData.psicossocial?.reacoesComando} onChange={v => handleUpdate('psicossocial', 'reacoesComando', v)} /></View>}

                <YesNoQuestion question="Tem muitos amigos?" value={formData.psicossocial?.muitosAmigos} onValueChange={v => handleUpdate('psicossocial', 'muitosAmigos', v)} />
                <YesNoQuestion question="Tem amigos próximos?" value={formData.psicossocial?.amigosProximos} onValueChange={v => handleUpdate('psicossocial', 'amigosProximos', v)} />
                {formData.psicossocial?.amigosProximos && <View style={styles.dependentField}><Input label="Quantos?" value={formData.psicossocial?.quantosAmigosProximos} onChange={v => handleUpdate('psicossocial', 'quantosAmigosProximos', v)} keyboardType="numeric" /></View>}
                
                {/* --- SEÇÃO V: ESCOLARIDADE --- */}
                <SectionTitle title="V - Escolaridade" />
                <YesNoQuestion question="Frequentou creche?" value={formData.escolaridade?.frequentouCreche} onValueChange={v => handleUpdate('escolaridade', 'frequentouCreche', v)} />
                {formData.escolaridade?.frequentouCreche && <View style={styles.dependentField}><Input label="Com que idade?" value={formData.escolaridade?.idadeCreche} onChange={v => handleUpdate('escolaridade', 'idadeCreche', v)} keyboardType="numeric" /></View>}

                <Input label="Com que idade ingressou na escola?" value={formData.escolaridade?.idadeIngressoEscola} onChange={v => handleUpdate('escolaridade', 'idadeIngressoEscola', v)} keyboardType="numeric" />
                <Input label="Qual sua reação no primeiro dia de aula?" value={formData.escolaridade?.reacaoPrimeiroDia} onChange={v => handleUpdate('escolaridade', 'reacaoPrimeiroDia', v)} />

                <YesNoQuestion question="Gosta de estudar?" value={formData.escolaridade?.gostaEstudar} onValueChange={v => handleUpdate('escolaridade', 'gostaEstudar', v)} />

                <YesNoQuestion question="Apresenta dificuldades nos estudos?" value={formData.escolaridade?.temDificuldades} onValueChange={v => handleUpdate('escolaridade', 'temDificuldades', v)} />
                {formData.escolaridade?.temDificuldades && <View style={styles.dependentField}><Input label="Quais?" value={formData.escolaridade?.quaisDificuldades} onChange={v => handleUpdate('escolaridade', 'quaisDificuldades', v)} /></View>}

                <YesNoQuestion question="Necessita de ajuda?" value={formData.escolaridade?.necessitaAjuda} onValueChange={v => handleUpdate('escolaridade', 'necessitaAjuda', v)} />
                {formData.escolaridade?.necessitaAjuda && <View style={styles.dependentField}><Input label="Quem o ajuda?" value={formData.escolaridade?.quemAjuda} onChange={v => handleUpdate('escolaridade', 'quemAjuda', v)} /></View>}

                <YesNoQuestion question="Além da escola regular, faz algum outro curso?" value={formData.escolaridade?.fazOutroCurso} onValueChange={v => handleUpdate('escolaridade', 'fazOutroCurso', v)} />
                {formData.escolaridade?.fazOutroCurso && <View style={styles.dependentField}><Input label="Qual?" value={formData.escolaridade?.qualOutroCurso} onChange={v => handleUpdate('escolaridade', 'qualOutroCurso', v)} /></View>}

                <YesNoQuestion question="Já foi transferido de escola?" value={formData.escolaridade?.foiTransferido} onValueChange={v => handleUpdate('escolaridade', 'foiTransferido', v)} />
                {formData.escolaridade?.foiTransferido && <View style={styles.dependentField}><Input label="Motivo" value={formData.escolaridade?.motivoTransferencia} onChange={v => handleUpdate('escolaridade', 'motivoTransferencia', v)} /></View>}

                <YesNoQuestion question="Relaciona-se bem com os professores?" value={formData.escolaridade?.relacaoProfessores} onValueChange={v => handleUpdate('escolaridade', 'relacaoProfessores', v)} />
                {formData.escolaridade?.relacaoProfessores === false && <View style={styles.dependentField}><Input label="Comente" value={formData.escolaridade?.comentarioProfessores} onChange={v => handleUpdate('escolaridade', 'comentarioProfessores', v)} /></View>}

                <YesNoQuestion question="Relaciona-se bem com os colegas de sala?" value={formData.escolaridade?.relacaoColegas} onValueChange={v => handleUpdate('escolaridade', 'relacaoColegas', v)} />
                {formData.escolaridade?.relacaoColegas === false && <View style={styles.dependentField}><Input label="Comente" value={formData.escolaridade?.comentarioColegas} onChange={v => handleUpdate('escolaridade', 'comentarioColegas', v)} /></View>}

                <Input label="Quem costuma participar das reuniões escolares?" value={formData.escolaridade?.participaReunioes} onChange={v => handleUpdate('escolaridade', 'participaReunioes', v)} />

                {/* --- SEÇÃO VI: DESENVOLVIMENTO DA LINGUAGEM --- */}
                <SectionTitle title="VI – Desenvolvimento da Linguagem" />
                <PickerQuestion 
                    label="a) Comunica-se com clareza, expressando-se e organizando seu pensamento?"
                    selectedValue={formData.linguagem?.comunicaComClareza}
                    onValueChange={v => handleUpdate('linguagem', 'comunicaComClareza', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Sim', value: 'sim'},
                        {label: 'Não', value: 'nao'},
                        {label: 'Às Vezes', value: 'as_vezes'},
                    ]}
                />
                <YesNoQuestion question="b) Tem vocabulário adequado para sua idade?" value={formData.linguagem?.vocabularioAdequado} onValueChange={v => handleUpdate('linguagem', 'vocabularioAdequado', v)} />
                <YesNoQuestion question="c) Compreende comunicações verbais?" value={formData.linguagem?.compreendeVerbal} onValueChange={v => handleUpdate('linguagem', 'compreendeVerbal', v)} />

                <PickerQuestion 
                    label="d) Quando relata fatos:"
                    selectedValue={formData.linguagem?.velocidadeFala}
                    onValueChange={v => handleUpdate('linguagem', 'velocidadeFala', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Fala muito rápido', value: 'rapido'},
                        {label: 'Fala muito devagar', value: 'devagar'},
                        {label: 'Normal', value: 'normal'},
                    ]}
                />
                <PickerQuestion 
                    label="e) Relata fatos em sequência?"
                    selectedValue={formData.linguagem?.relataSequencia}
                    onValueChange={v => handleUpdate('linguagem', 'relataSequencia', v)}
                    items={[ {label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'} ]}
                />
                <PickerQuestion 
                    label="f) Relata sempre os mesmos fatos ou coisas imaginárias?"
                    selectedValue={formData.linguagem?.relataFatosImaginarios}
                    onValueChange={v => handleUpdate('linguagem', 'relataFatosImaginarios', v)}
                    items={[ {label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'} ]}
                />
                <PickerQuestion 
                    label="g) Em que nível ou etapa se encontra a escrita da criança?"
                    selectedValue={formData.linguagem?.nivelEscrita}
                    onValueChange={v => handleUpdate('linguagem', 'nivelEscrita', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Garatuja', value: 'garatuja'},
                        {label: 'Pré-silábica', value: 'pre_silabica'},
                        {label: 'Silábica', value: 'silabica'},
                        {label: 'Silábica Alfabética', value: 'silabica_alfabetica'},
                        {label: 'Alfabética', value: 'alfabetica'},
                    ]}
                />
                <PickerQuestion 
                    label="h) A criança apresenta interesse pela escrita?"
                    selectedValue={formData.linguagem?.interesseEscrita}
                    onValueChange={v => handleUpdate('linguagem', 'interesseEscrita', v)}
                    items={[ {label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Parcialmente', value: 'parcialmente'} ]}
                />
                <PickerQuestion 
                    label="i) Memoriza canções, versos, brincadeiras?"
                    selectedValue={formData.linguagem?.memorizaCancoes}
                    onValueChange={v => handleUpdate('linguagem', 'memorizaCancoes', v)}
                    items={[ {label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'} ]}
                />
                <PickerQuestion 
                    label="j) É capaz de reproduzir histórias contadas?"
                    selectedValue={formData.linguagem?.reproduzHistorias}
                    onValueChange={v => handleUpdate('linguagem', 'reproduzHistorias', v)}
                    items={[ {label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Parcialmente', value: 'parcialmente'} ]}
                />

                {/* --- SEÇÃO VII: DADOS SOBRE SAÚDE --- */}
                <SectionTitle title="VII – Dados Sobre Saúde" />
                <YesNoQuestion question="Foi submetido a tratamento médico?" value={formData.saude?.fezTratamento} onValueChange={v => handleUpdate('saude', 'fezTratamento', v)} />
                {formData.saude?.fezTratamento && <View style={styles.dependentField}>
                    <Input label="Idade" value={formData.saude?.idadeTratamento} onChange={v => handleUpdate('saude', 'idadeTratamento', v)} keyboardType="numeric" />
                    <Input label="Causa" value={formData.saude?.causaTratamento} onChange={v => handleUpdate('saude', 'causaTratamento', v)} />
                </View>}

                <YesNoQuestion question="Fez alguma cirurgia?" value={formData.saude?.fezCirurgia} onValueChange={v => handleUpdate('saude', 'fezCirurgia', v)} />
                {formData.saude?.fezCirurgia && <View style={styles.dependentField}>
                    <Input label="Idade" value={formData.saude?.idadeCirurgia} onChange={v => handleUpdate('saude', 'idadeCirurgia', v)} keyboardType="numeric" />
                    <Input label="Causa" value={formData.saude?.causaCirurgia} onChange={v => handleUpdate('saude', 'causaCirurgia', v)} />
                </View>}

                <YesNoQuestion question="Toma medicamentos regularmente?" value={formData.saude?.tomaMedicamentos} onValueChange={v => handleUpdate('saude', 'tomaMedicamentos', v)} />
                {formData.saude?.tomaMedicamentos && <View style={styles.dependentField}><Input label="Quais?" value={formData.saude?.quaisMedicamentos} onChange={v => handleUpdate('saude', 'quaisMedicamentos', v)} /></View>}

                <Input label="Quais doenças ou alergias tem?" value={formData.saude?.doencasAlergias} onChange={v => handleUpdate('saude', 'doencasAlergias', v)} />

                <Text style={styles.subSectionTitle}>Frequência de Visitas ao Médico</Text>
                <MedicalVisitBlock specialist="Pediatra" section="saude" fieldPrefix="pediatra" formData={formData} onUpdate={handleUpdate} />
                <MedicalVisitBlock specialist="Ortopedista" section="saude" fieldPrefix="ortopedista" formData={formData} onUpdate={handleUpdate} />
                <MedicalVisitBlock specialist="Alergista" section="saude" fieldPrefix="alergista" formData={formData} onUpdate={handleUpdate} />
                <MedicalVisitBlock specialist="Oftalmologista" section="saude" fieldPrefix="oftalmologista" formData={formData} onUpdate={handleUpdate} />
                <MedicalVisitBlock specialist="Odontologista" section="saude" fieldPrefix="odontologista" formData={formData} onUpdate={handleUpdate} />


                {/* --- SEÇÃO VIII: DADOS SOBRE SEXUALIDADE --- */}
                <SectionTitle title="VIII – Dados Sobre Sexualidade" />
                <YesNoQuestion question="Apresenta curiosidade sobre sexo?" value={formData.sexualidade?.temCuriosidade} onValueChange={v => handleUpdate('sexualidade', 'temCuriosidade', v)} />
                {formData.sexualidade?.temCuriosidade && <View style={styles.dependentField}><Input label="Qual?" value={formData.sexualidade?.qualCuriosidade} onChange={v => handleUpdate('sexualidade', 'qualCuriosidade', v)} /></View>}

                <Input label="Com quem conversa sobre sexo?" value={formData.sexualidade?.conversaCom} onChange={v => handleUpdate('sexualidade', 'conversaCom', v)} />
                <YesNoQuestion question="Masturba-se?" value={formData.sexualidade?.masturbaSe} onValueChange={v => handleUpdate('sexualidade', 'masturbaSe', v)} />

                <YesNoQuestion question="Namora?" value={formData.sexualidade?.namora} onValueChange={v => handleUpdate('sexualidade', 'namora', v)} />
                {formData.sexualidade?.namora && <View style={styles.dependentField}><Input label="Início" value={formData.sexualidade?.inicioNamoro} onChange={v => handleUpdate('sexualidade', 'inicioNamoro', v)} /></View>}

                <YesNoQuestion question="É sexualmente ativo(a)?" value={formData.sexualidade?.sexualmenteAtivo} onValueChange={v => handleUpdate('sexualidade', 'sexualmenteAtivo', v)} />
                {formData.sexualidade?.sexualmenteAtivo && <View style={styles.dependentField}><Input label="Início" value={formData.sexualidade?.inicioAtividadeSexual} onChange={v => handleUpdate('sexualidade', 'inicioAtividadeSexual', v)} /></View>}


                {/* --- SEÇÃO IX: AVALIAÇÃO TÉCNICA --- */}
                <SectionTitle title="IX - Avaliação Técnica" />
                <PickerQuestion 
                    label="a) Apresenta noções de espaço–tempo?"
                    selectedValue={formData.avaliacaoTecnica?.espacoTempo}
                    onValueChange={v => handleUpdate('avaliacaoTecnica', 'espacoTempo', v)}
                    items={[{label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'}]}
                />
                <PickerQuestion 
                    label="b) Apresenta conservação de quantidade, seriação e classificação?"
                    selectedValue={formData.avaliacaoTecnica?.conservacaoQuantidade}
                    onValueChange={v => handleUpdate('avaliacaoTecnica', 'conservacaoQuantidade', v)}
                    items={[{label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'}]}
                />
                <PickerQuestion 
                    label="c) Identifica partes do corpo?"
                    selectedValue={formData.avaliacaoTecnica?.partesCorpo}
                    onValueChange={v => handleUpdate('avaliacaoTecnica', 'partesCorpo', v)}
                    items={[{label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'}]}
                />
                <PickerQuestion 
                    label="d) Reconhece numerais?"
                    selectedValue={formData.avaliacaoTecnica?.reconheceNumerais}
                    onValueChange={v => handleUpdate('avaliacaoTecnica', 'reconheceNumerais', v)}
                    items={[{label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'}]}
                />
                <PickerQuestion 
                    label="e) Reconhece letras?"
                    selectedValue={formData.avaliacaoTecnica?.reconheceLetras}
                    onValueChange={v => handleUpdate('avaliacaoTecnica', 'reconheceLetras', v)}
                    items={[{label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'}]}
                />
                <PickerQuestion 
                    label="f) Relaciona numerais a quantidades?"
                    selectedValue={formData.avaliacaoTecnica?.relacionaNumerais}
                    onValueChange={v => handleUpdate('avaliacaoTecnica', 'relacionaNumerais', v)}
                    items={[{label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'}]}
                />
                <PickerQuestion 
                    label="g) Encontra soluções para resolução de problemas?"
                    selectedValue={formData.avaliacaoTecnica?.resolveProblemas}
                    onValueChange={v => handleUpdate('avaliacaoTecnica', 'resolveProblemas', v)}
                    items={[{label: 'Selecione...', value: ''}, {label: 'Sim', value: 'sim'}, {label: 'Não', value: 'nao'}, {label: 'Às Vezes', value: 'as_vezes'}]}
                />

                <CheckboxGroup
                    label="h) A criança detém:"
                    options={[
                        { label: 'Lateralidade', value: 'lateralidade' },
                        { label: 'Harmonia', value: 'harmonia' },
                        { label: 'Equilíbrio', value: 'equilibrio' },
                        { label: 'Ritmo', value: 'ritmo' },
                        { label: 'Coordenação', value: 'coordenacao' },
                        { label: 'Uso e aplicação da força', value: 'forca' },
                    ]}
                    selectedOptions={formData.avaliacaoTecnica?.detem}
                    onSelectionChange={v => handleUpdate('avaliacaoTecnica', 'detem', v)}
                />
                <CheckboxGroup
                    label="i) A criança realiza operações matemáticas:"
                    options={[
                        { label: 'Adição', value: 'adicao' },
                        { label: 'Subtração', value: 'subtracao' },
                        { label: 'Multiplicação', value: 'multiplicacao' },
                        { label: 'Divisão', value: 'divisao' },
                    ]}
                    selectedOptions={formData.avaliacaoTecnica?.operacoesMatematicas}
                    onSelectionChange={v => handleUpdate('avaliacaoTecnica', 'operacoesMatematicas', v)}
                />


                {/* --- SEÇÃO X: ANTECEDENTES FAMILIARES --- */}
                <SectionTitle title="X - Antecedentes Familiares" />
                <YesNoQuestion question="Casos de doenças na família?" value={formData.antecedentes?.doencasFamilia} onValueChange={v => handleUpdate('antecedentes', 'doencasFamilia', v)} />
                {formData.antecedentes?.doencasFamilia && <View style={styles.dependentField}><Input label="Quais?" value={formData.antecedentes?.quaisDoencas} onChange={v => handleUpdate('antecedentes', 'quaisDoencas', v)} /></View>}

                <YesNoQuestion question="Parentesco entre os pais?" value={formData.antecedentes?.parentescoPais} onValueChange={v => handleUpdate('antecedentes', 'parentescoPais', v)} />
                {formData.antecedentes?.parentescoPais && <View style={styles.dependentField}><Input label="Qual?" value={formData.antecedentes?.qualParentesco} onChange={v => handleUpdate('antecedentes', 'qualParentesco', v)} /></View>}

                <YesNoQuestion question="Pessoas com necessidades específicas na família?" value={formData.antecedentes?.necessidadesEspecificas} onValueChange={v => handleUpdate('antecedentes', 'necessidadesEspecificas', v)} />
                {formData.antecedentes?.necessidadesEspecificas && <View style={styles.dependentField}><Input label="Quais?" value={formData.antecedentes?.quaisNecessidades} onChange={v => handleUpdate('antecedentes', 'quaisNecessidades', v)} /></View>}


                {/* --- SEÇÃO XI: COMPOSIÇÃO FAMILIAR --- */}
                <SectionTitle title="XI - Composição Familiar e Relacionamento" />
                <Text style={styles.subSectionTitle}>Pessoas que moram com a criança</Text>
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, {flex: 3}]}>Nome</Text>
                        <Text style={[styles.tableHeaderText, {flex: 1}]}>Idade</Text>
                        <Text style={[styles.tableHeaderText, {flex: 2}]}>Parentesco</Text>
                        <Text style={[styles.tableHeaderText, {flex: 2}]}>Escolaridade</Text>
                        <View style={{width: 30}} />
                    </View>
                    {(formData.composicaoFamiliar?.membros || []).map((member, index) => (
                        <FamilyMemberRow
                            key={index}
                            index={index}
                            member={member}
                            onUpdate={(idx, field, value) => {
                                const updatedMembers = [...(formData.composicaoFamiliar?.membros || [])];
                                updatedMembers[idx] = { ...updatedMembers[idx], [field]: value };
                                handleUpdate('composicaoFamiliar', 'membros', updatedMembers);
                            }}
                            onRemove={(idx) => {
                                const updatedMembers = (formData.composicaoFamiliar?.membros || []).filter((_, i) => i !== idx);
                                handleUpdate('composicaoFamiliar', 'membros', updatedMembers);
                            }}
                        />
                    ))}
                    <TouchableOpacity style={styles.addRowBtn} onPress={() => {
                        const currentMembers = formData.composicaoFamiliar?.membros || [];
                        handleUpdate('composicaoFamiliar', 'membros', [...currentMembers, { nome: '', idade: '', parentesco: '', escolaridade: '' }]);
                    }}>
                        <MaterialIcons name="add" size={20} color={ABAETE_COLORS.primaryBlue} />
                        <Text style={styles.addRowBtnText}>Adicionar Membro</Text>
                    </TouchableOpacity>
                </View>

                <Input label="Relacionamento entre os pais" value={formData.composicaoFamiliar?.relacionamentoPais} onChange={v => handleUpdate('composicaoFamiliar', 'relacionamentoPais', v)} />
                <Input label="Entre a mãe e a criança" value={formData.composicaoFamiliar?.relacionamentoMae} onChange={v => handleUpdate('composicaoFamiliar', 'relacionamentoMae', v)} />
                <Input label="Entre o pai e a criança" value={formData.composicaoFamiliar?.relacionamentoPai} onChange={v => handleUpdate('composicaoFamiliar', 'relacionamentoPai', v)} />
                <Input label="Entre a criança e os irmãos" value={formData.composicaoFamiliar?.relacionamentoIrmaos} onChange={v => handleUpdate('composicaoFamiliar', 'relacionamentoIrmaos', v)} />

                {/* --- SEÇÃO XII: SONO --- */}
                <SectionTitle title="XII – Sono" />
                <CheckboxGroup
                    label="Atualmente o sono é:"
                    options={[
                        { label: 'Calmo', value: 'calmo' },
                        { label: 'Agitado', value: 'agitado' },
                        { label: 'Acorda muitas vezes', value: 'acorda_muito' },
                        { label: 'Fala dormindo', value: 'fala_dormindo' },
                        { label: 'Range os dentes', value: 'range_dentes' },
                        { label: 'Olhos abertos', value: 'olhos_abertos' },
                        { label: 'Terror noturno', value: 'terror_noturno' },
                        { label: 'Pesadelos', value: 'pesadelos' },
                        { label: 'Ronca', value: 'ronca' },
                        { label: 'Enurese noturna', value: 'enurese_noturna' },
                    ]}
                    selectedOptions={formData.sono?.caracteristicas}
                    onSelectionChange={v => handleUpdate('sono', 'caracteristicas', v)}
                />

                <Input label="Que horas dorme?" value={formData.sono?.horaDorme} onChange={v => handleUpdate('sono', 'horaDorme', v)} placeholder="Ex: 21:00" />
                <Input label="Qual sua rotina antes de dormir?" value={formData.sono?.rotinaAntesDormir} onChange={v => handleUpdate('sono', 'rotinaAntesDormir', v)} />
                <Input label="Que horas acorda?" value={formData.sono?.horaAcorda} onChange={v => handleUpdate('sono', 'horaAcorda', v)} placeholder="Ex: 07:00" />
                <Input label="Qual sua rotina depois que acorda?" value={formData.sono?.rotinaDepoisAcordar} onChange={v => handleUpdate('sono', 'rotinaDepoisAcordar', v)} />
                <Input label="Dorme sozinho?" value={formData.sono?.dormeSozinho} onChange={v => handleUpdate('sono', 'dormeSozinho', v)} />
                <Input label="Cama separada?" value={formData.sono?.camaSeparada} onChange={v => handleUpdate('sono', 'camaSeparada', v)} />
                <Input label="Até que idade dormiu com os pais?" value={formData.sono?.idadeDormiuPais} onChange={v => handleUpdate('sono', 'idadeDormiuPais', v)} />
                <Input label="Dorme no meio dos pais ou tem preferência?" value={formData.sono?.preferenciaDormir} onChange={v => handleUpdate('sono', 'preferenciaDormir', v)} />
                <Input label="Qual foi a atitude tomada para separá-los?" value={formData.sono?.atitudeSeparacao} onChange={v => handleUpdate('sono', 'atitudeSeparacao', v)} />
                <Input label="Como a criança reagiu?" value={formData.sono?.reacaoSeparacao} onChange={v => handleUpdate('sono', 'reacaoSeparacao', v)} />
                <Input label="Precisa de algum objeto para dormir?" value={formData.sono?.objetoParaDormir} onChange={v => handleUpdate('sono', 'objetoParaDormir', v)} />


                {/* --- SEÇÃO XIII: ALIMENTAÇÃO --- */}
                <SectionTitle title="XIII – Alimentação" />
                <Input label="Como é a sua alimentação atualmente?" value={formData.alimentacao?.descricao} onChange={v => handleUpdate('alimentacao', 'descricao', v)} placeholder="Come bem, não gosta de comer, etc." />
                <Input label="Almoça onde?" value={formData.alimentacao?.localAlmoco} onChange={v => handleUpdate('alimentacao', 'localAlmoco', v)} />
                <Input label="Janta onde?" value={formData.alimentacao?.localJanta} onChange={v => handleUpdate('alimentacao', 'localJanta', v)} />
                <Input label="Come sozinho ou com a família?" value={formData.alimentacao?.companhiaRefeicao} onChange={v => handleUpdate('alimentacao', 'companhiaRefeicao', v)} />
                <Input label="Necessita de auxílio para se alimentar?" value={formData.alimentacao?.necessitaAuxilio} onChange={v => handleUpdate('alimentacao', 'necessitaAuxilio', v)} />

                {/* --- SEÇÃO XIV: ATIVIDADES DA VIDA DIARIA – AVD --- */}
                <SectionTitle title="XIV – Atividades da Vida Diária (AVD)" />
                <Text style={styles.subSectionTitle}>1 - Cuidados Pessoais</Text>
                <PickerQuestion 
                    label="A – Alimentação"
                    selectedValue={formData.avd?.cuidadosPessoais_Alimentacao}
                    onValueChange={v => handleUpdate('avd', 'cuidadosPessoais_Alimentacao', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Normal', value: 'normal'},
                        {label: 'Independente', value: 'independente'},
                        {label: 'Necessita de ajuda para cortar/servir, derruba com frequência', value: 'ajuda_parcial'},
                        {label: 'Deve ser alimentado na maioria das refeições', value: 'ajuda_total'},
                    ]}
                />
                <PickerQuestion 
                    label="B – Vestir-se"
                    selectedValue={formData.avd?.cuidadosPessoais_Vestir}
                    onValueChange={v => handleUpdate('avd', 'cuidadosPessoais_Vestir', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Normal', value: 'normal'},
                        {label: 'Independente, mas lento e desajeitado', value: 'independente_lento'},
                        {label: 'Sequência errada, esquece itens', value: 'sequencia_errada'},
                        {label: 'Necessita de ajuda para vestir-se', value: 'necessita_ajuda'},
                    ]}
                />
                <PickerQuestion 
                    label="C – Banho"
                    selectedValue={formData.avd?.cuidadosPessoais_Banho}
                    onValueChange={v => handleUpdate('avd', 'cuidadosPessoais_Banho', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Normal', value: 'normal'},
                        {label: 'Banha-se só, mas necessita ser lembrado', value: 'lembrado'},
                        {label: 'Banha-se só, com assistência', value: 'assistencia'},
                        {label: 'Deve ser banhado por outros', value: 'ajuda_total'},
                    ]}
                />
                <PickerQuestion 
                    label="D – Eliminações fisiológicas"
                    selectedValue={formData.avd?.cuidadosPessoais_Eliminacoes}
                    onValueChange={v => handleUpdate('avd', 'cuidadosPessoais_Eliminacoes', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Vai ao banheiro independentemente', value: 'independente'},
                        {label: 'Vai ao banheiro quando lembrado: alguns problemas', value: 'lembrado'},
                        {label: 'Precisa de assistência para a atividade', value: 'assistencia'},
                        {label: 'Não tem controle sobre fezes e urina', value: 'sem_controle'},
                    ]}
                />
                <PickerQuestion 
                    label="E – Interesse na aparência pessoal"
                    selectedValue={formData.avd?.cuidadosPessoais_Aparencia}
                    onValueChange={v => handleUpdate('avd', 'cuidadosPessoais_Aparencia', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'O mesmo de sempre', value: 'normal'},
                        {label: 'Interessa-se quando vai sair, mas não em casa', value: 'interesse_social'},
                        {label: 'Permite ser arrumado ou o faz quando solicitado', value: 'solicitado'},
                        {label: 'Resiste para ser limpo e trocado por terceiros', value: 'resiste'},
                    ]}
                />

                <Text style={styles.subSectionTitle}>2 - Cuidados Domésticos</Text>
                <PickerQuestion 
                    label="A – Arrumação do quarto"
                    selectedValue={formData.avd?.cuidadosDomesticos_Quarto}
                    onValueChange={v => handleUpdate('avd', 'cuidadosDomesticos_Quarto', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Normal', value: 'normal'},
                        {label: 'Independente, mas lento ou desajeitado', value: 'independente_lento'},
                        {label: 'Esquece-se de itens ou os coloca em local errado', value: 'esquece_itens'},
                        {label: 'Não realiza esta atividade, mãe ou pai faz', value: 'nao_realiza'},
                    ]}
                />
                <PickerQuestion 
                    label="B – Trabalhos domésticos"
                    selectedValue={formData.avd?.cuidadosDomesticos_Trabalhos}
                    onValueChange={v => handleUpdate('avd', 'cuidadosDomesticos_Trabalhos', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Mantém a casa como de costume', value: 'normal'},
                        {label: 'Ocasionalmente faz pequenos serviços sem precisar pedir', value: 'ocasional_independente'},
                        {label: 'Ocasionalmente faz pequenos serviços com ajuda', value: 'ocasional_com_ajuda'},
                        {label: 'Não cuida da casa', value: 'nao_cuida'},
                    ]}
                />
                <PickerQuestion 
                    label="C - Lavar louça"
                    selectedValue={formData.avd?.cuidadosDomesticos_Louca}
                    onValueChange={v => handleUpdate('avd', 'cuidadosDomesticos_Louca', v)}
                    items={[
                        {label: 'Selecione...', value: ''},
                        {label: 'Lava-as como de costume (rotina)', value: 'rotina'},
                        {label: 'Lava com menor frequência', value: 'menor_frequencia'},
                        {label: 'Lava apenas se lembrado', value: 'lembrado'},
                        {label: 'Não lava', value: 'nao_lava'},
                    ]}
                />

                <Input label="Observações Finais" value={formData.observacoesFinais} onChange={v => handleUpdate('observacoesFinais', 'texto', v)} />

                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Enviar Formulário</Text>}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

// Estilos para a tela e seus componentes
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: ABAETE_COLORS.backgroundMain },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray, backgroundColor: ABAETE_COLORS.white, paddingTop: Platform.OS === 'android' ? 40 : 16, },
    headerTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 20, color: ABAETE_COLORS.textPrimary },
    container: { padding: 20 },
    sectionTitle: { fontFamily: FONT_FAMILY.Bold, fontSize: 18, color: ABAETE_COLORS.primaryBlue, marginTop: 25, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: ABAETE_COLORS.lightGray, paddingBottom: 10 },
    inputGroup: { marginBottom: 15 },
    label: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 14, color: ABAETE_COLORS.textSecondary, marginBottom: 8 },
    input: { backgroundColor: ABAETE_COLORS.white, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, padding: 12, fontSize: 16, fontFamily: FONT_FAMILY.Regular },
    questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    questionText: { fontFamily: FONT_FAMILY.Regular, fontSize: 16, color: ABAETE_COLORS.textPrimary, flex: 1 },
    switchContainer: { flexDirection: 'row', borderWidth: 1, borderColor: ABAETE_COLORS.primaryBlue, borderRadius: 8, overflow: 'hidden' },
    switchButton: { paddingVertical: 8, paddingHorizontal: 16 },
    switchActive: { backgroundColor: ABAETE_COLORS.primaryBlue },
    switchText: { fontFamily: FONT_FAMILY.SemiBold, color: ABAETE_COLORS.primaryBlue },
    switchTextActive: { color: ABAETE_COLORS.white },
    saveButton: { backgroundColor: ABAETE_COLORS.primaryBlue, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30, marginBottom: 50 },
    saveButtonText: { color: 'white', fontFamily: FONT_FAMILY.SemiBold, fontSize: 16 },
    subSectionTitle: { fontFamily: FONT_FAMILY.SemiBold, fontSize: 16, color: ABAETE_COLORS.textPrimary, marginTop: 20, marginBottom: 10, },
    dependentField: { paddingLeft: 15, borderLeftWidth: 3, borderLeftColor: ABAETE_COLORS.primaryBlueLight, marginTop: 10, marginBottom: 5 },
    pickerWrapper: { borderWidth: 1, borderColor: ABAETE_COLORS.lightGray, borderRadius: 8, backgroundColor: ABAETE_COLORS.white, },
    inputDisabled: { backgroundColor: '#f0f2f5', color: '#6c757d' },
    questionContainer: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: ABAETE_COLORS.lightGray },
    specialistBlock: {
        backgroundColor: ABAETE_COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
    },
    specialistTitle: {
        fontFamily: FONT_FAMILY.SemiBold,
        fontSize: 16,
        color: ABAETE_COLORS.secondaryBlue,
        marginBottom: 10,
    },
    checkboxContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    checkboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '50%', // Duas colunas
        marginBottom: 10,
    },
    checkboxLabel: {
        marginLeft: 8,
        fontFamily: FONT_FAMILY.Regular,
        fontSize: 16,
    },

    // --- Estilos para a Tabela de Composição Familiar ---
    table: {
        backgroundColor: ABAETE_COLORS.white,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
        borderRadius: 8,
        padding: 10,
        marginBottom: 20,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: ABAETE_COLORS.lightGray,
        paddingBottom: 8,
        marginBottom: 8,
    },
    tableHeaderText: {
        fontFamily: FONT_FAMILY.SemiBold,
        color: ABAETE_COLORS.textSecondary,
        fontSize: 12,
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    tableInput: {
        height: 40,
        borderWidth: 1,
        borderColor: ABAETE_COLORS.lightGray,
        borderRadius: 6,
        paddingHorizontal: 8,
        fontSize: 14,
    },
    removeRowBtn: {
        padding: 4,
    },
    addRowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0'
    },
    addRowBtnText: {
        color: ABAETE_COLORS.primaryBlue,
        fontFamily: FONT_FAMILY.SemiBold,
        marginLeft: 8,
    },
});