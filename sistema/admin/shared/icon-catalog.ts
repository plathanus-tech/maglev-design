import type { ComponentType } from 'react';
import {
  IconAirConditioning, IconAlarm, IconBattery, IconBeer, IconBlender, IconBolt, IconBottle, IconBox, IconBread, IconBrush, IconBucket,
  IconBuilding, IconBulb, IconCategory, IconChefHat, IconCoffee, IconCooker, IconCpu, IconDeviceCctv, IconDoor, IconDots, IconDroplet,
  IconDroplets, IconEngine, IconFireExtinguisher, IconFireHydrant, IconFish, IconFlame, IconFridge, IconGasStation, IconGauge, IconGrill,
  IconHammer, IconHammerDrill, IconIceCream2, IconIceberg, IconLamp, IconLock, IconMeat, IconMicrowave, IconPipeline, IconPizza, IconPlug,
  IconPlugConnected, IconPropeller, IconRecycle, IconScale, IconSettings, IconShieldCheck, IconSnowflake, IconSpray, IconStairs, IconStar,
  IconTag, IconTank, IconTemperatureSnow, IconTemperatureSun, IconThermometer, IconTool, IconToolsKitchen2, IconTools, IconTrash, IconTruck,
  IconWall, IconWashMachine, IconWind, IconWindow,
} from '@tabler/icons-react';

/**
 * Catálogo curado de ícones (Tabler) para categorias de equipamento. Só estes ícones são importados.
 * `id` é o identificador estável salvo na categoria (nunca o componente); `name` e `keywords` são em português
 * e alimentam a busca. Para ampliar: importar o ícone acima e acrescentar uma linha no grupo certo.
 */
export interface CatalogIcon { id: string; name: string; keywords: string[]; Icon: ComponentType<{ size?: number | string }> }
export interface CatalogGroup { label: string; icons: CatalogIcon[] }

const i = (id: string, name: string, keywords: string, Icon: CatalogIcon['Icon']): CatalogIcon => ({
  id, name, keywords: keywords.split(',').map((k) => k.trim()), Icon,
});

export const ICON_GROUPS: CatalogGroup[] = [
  { label: 'Refrigeração', icons: [
    i('frio', 'Frio', 'frio, freezer, congelador, refrigeração', IconSnowflake),
    i('camara-fria', 'Câmara fria', 'câmara, resfriado, temperatura baixa', IconTemperatureSnow),
    i('geladeira', 'Geladeira', 'refrigerador, balcão, expositor', IconFridge),
    i('gelo', 'Gelo', 'gelo, fábrica de gelo, máquina de gelo', IconIceberg),
    i('sorvete', 'Sorvete', 'sorveteira, gelato, sobremesa gelada', IconIceCream2),
  ] },
  { label: 'Calor e cocção', icons: [
    i('calor', 'Calor', 'fogo, chama, fogão, queima, calor', IconFlame),
    i('forno', 'Forno', 'forno, micro-ondas, aquecimento', IconMicrowave),
    i('fogao', 'Fogão', 'cooktop, fogão industrial, fogão', IconCooker),
    i('grelha', 'Grelha', 'chapa, churrasqueira, grill, grelha', IconGrill),
    i('cozinha', 'Cozinha', 'utensílios, talheres, cozinha', IconToolsKitchen2),
    i('chef', 'Chef', 'cozinha, cocção, chef, gastronomia', IconChefHat),
  ] },
  { label: 'Elétrica e energia', icons: [
    i('energia', 'Energia', 'elétrica, raio, tensão, energia', IconBolt),
    i('tomada', 'Tomada', 'plugue, ponto elétrico, tomada', IconPlug),
    i('conexao', 'Conexão', 'ligado, alimentação, conexão', IconPlugConnected),
    i('bateria', 'Bateria', 'nobreak, carga, bateria', IconBattery),
    i('painel', 'Painel', 'placa, comando, eletrônica, painel', IconCpu),
  ] },
  { label: 'Água e hidráulica', icons: [
    i('agua', 'Água', 'gota, torneira, abastecimento, água', IconDroplet),
    i('hidraulica', 'Hidráulica', 'vazamento, encanamento, hidráulica', IconDroplets),
    i('tubulacao', 'Tubulação', 'cano, tubo, rede, tubulação', IconPipeline),
    i('balde', 'Balde', 'ralo, esgoto, descarte, balde', IconBucket),
    i('reservatorio', 'Reservatório', "caixa d'água, tanque, reservatório", IconTank),
  ] },
  { label: 'Climatização e ventilação', icons: [
    i('ar-condicionado', 'Ar-condicionado', 'split, climatização, ar-condicionado', IconAirConditioning),
    i('ventilacao', 'Ventilação', 'vento, circulação de ar, ventilação', IconWind),
    i('ventilador', 'Ventilador', 'hélice, exaustor, coifa, ventilador', IconPropeller),
    i('termometro', 'Termômetro', 'temperatura, medição, termômetro', IconThermometer),
    i('calor-ambiente', 'Calor ambiente', 'quente, aquecedor, calor ambiente', IconTemperatureSun),
  ] },
  { label: 'Ferramentas e manutenção', icons: [
    i('ferramentas', 'Ferramentas', 'manutenção, reparo, conserto, ferramentas', IconTools),
    i('chave', 'Chave', 'chave de boca, ajuste, chave', IconTool),
    i('martelo', 'Martelo', 'obra, reparo, martelo', IconHammer),
    i('engrenagem', 'Engrenagem', 'configuração, mecânica, engrenagem', IconSettings),
    i('motor', 'Motor', 'motor, compressor', IconEngine),
    i('furadeira', 'Furadeira', 'perfuração, parafuso, furadeira', IconHammerDrill),
  ] },
  { label: 'Limpeza', icons: [
    i('limpeza', 'Limpeza', 'higienização, desinfecção, limpeza', IconSpray),
    i('lavagem', 'Lavagem', 'lava-louças, lavadora, lavagem', IconWashMachine),
    i('escova', 'Escova', 'escovar, limpar, escova', IconBrush),
    i('lixo', 'Lixo', 'descarte, resíduos, lixo', IconTrash),
    i('reciclagem', 'Reciclagem', 'reaproveitamento, reciclagem', IconRecycle),
  ] },
  { label: 'Segurança', icons: [
    i('seguranca', 'Segurança', 'proteção, conformidade, segurança', IconShieldCheck),
    i('extintor', 'Extintor', 'incêndio, combate a fogo, extintor', IconFireExtinguisher),
    i('hidrante', 'Hidrante', 'incêndio, mangueira, hidrante', IconFireHydrant),
    i('camera', 'Câmera', 'cftv, monitoramento, câmera', IconDeviceCctv),
    i('alarme', 'Alarme', 'alerta, sirene, alarme', IconAlarm),
    i('trava', 'Trava', 'fechadura, acesso, trava', IconLock),
  ] },
  { label: 'Cozinha e alimentos', icons: [
    i('liquidificador', 'Liquidificador', 'batedeira, processador, liquidificador', IconBlender),
    i('cafe', 'Café', 'cafeteira, máquina de café, café', IconCoffee),
    i('bebidas', 'Bebidas', 'chopeira, bar, cervejeira, bebidas', IconBeer),
    i('garrafa', 'Garrafa', 'bebida, dispenser, garrafa', IconBottle),
    i('carnes', 'Carnes', 'açougue, defumador, carnes', IconMeat),
    i('peixes', 'Peixes', 'pescados, sushi, peixes', IconFish),
    i('paes', 'Pães', 'padaria, forno de pão, panificação, pães', IconBread),
    i('pizza', 'Pizza', 'forno de pizza, pizzaria, pizza', IconPizza),
  ] },
  { label: 'Iluminação', icons: [
    i('lampada', 'Lâmpada', 'luz, iluminação, lâmpada', IconBulb),
    i('luminaria', 'Luminária', 'refletor, luminária', IconLamp),
  ] },
  { label: 'Gás', icons: [
    i('gas', 'Gás', 'glp, botijão, abastecimento, gás', IconGasStation),
    i('medidor', 'Medidor', 'manômetro, pressão, regulador, medidor', IconGauge),
  ] },
  { label: 'Estrutura e instalações', icons: [
    i('predio', 'Prédio', 'instalação, estrutura, prédio', IconBuilding),
    i('porta', 'Porta', 'portão, entrada, porta', IconDoor),
    i('janela', 'Janela', 'vidro, esquadria, janela', IconWindow),
    i('parede', 'Parede', 'alvenaria, revestimento, parede', IconWall),
    i('escada', 'Escada', 'acesso, degrau, escada', IconStairs),
  ] },
  { label: 'Equipamentos e outros', icons: [
    i('equipamento', 'Equipamento', 'caixa, aparelho, equipamento', IconBox),
    i('balanca', 'Balança', 'pesagem, peso, balança', IconScale),
    i('entrega', 'Entrega', 'transporte, carrinho, entrega', IconTruck),
    i('categoria', 'Categoria', 'geral, outros, categoria', IconCategory),
    i('etiqueta', 'Etiqueta', 'identificação, etiqueta', IconTag),
    i('destaque', 'Destaque', 'estrela, favorito, destaque', IconStar),
    i('outros', 'Outros', 'diversos, não classificado, outros', IconDots),
  ] },
];

export const ICON_CATALOG: CatalogIcon[] = ICON_GROUPS.flatMap((g) => g.icons);
const BY_ID = new Map(ICON_CATALOG.map((c) => [c.id, c]));
export const iconById = (id?: string): CatalogIcon | undefined => (id ? BY_ID.get(id) : undefined);
