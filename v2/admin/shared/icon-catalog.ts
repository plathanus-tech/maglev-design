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
 * CatÃ¡logo curado de Ã­cones (Tabler) para categorias de equipamento. SÃ³ estes Ã­cones sÃ£o importados.
 * `id` Ã© o identificador estÃ¡vel salvo na categoria (nunca o componente); `name` e `keywords` sÃ£o em portuguÃªs
 * e alimentam a busca. Para ampliar: importar o Ã­cone acima e acrescentar uma linha no grupo certo.
 */
export interface CatalogIcon { id: string; name: string; keywords: string[]; Icon: ComponentType<{ size?: number | string }> }
export interface CatalogGroup { label: string; icons: CatalogIcon[] }

const i = (id: string, name: string, keywords: string, Icon: CatalogIcon['Icon']): CatalogIcon => ({
  id, name, keywords: keywords.split(',').map((k) => k.trim()), Icon,
});

export const ICON_GROUPS: CatalogGroup[] = [
  { label: 'RefrigeraÃ§Ã£o', icons: [
    i('frio', 'Frio', 'frio, freezer, congelador, refrigeraÃ§Ã£o', IconSnowflake),
    i('camara-fria', 'CÃ¢mara fria', 'cÃ¢mara, resfriado, temperatura baixa', IconTemperatureSnow),
    i('geladeira', 'Geladeira', 'refrigerador, balcÃ£o, expositor', IconFridge),
    i('gelo', 'Gelo', 'gelo, fÃ¡brica de gelo, mÃ¡quina de gelo', IconIceberg),
    i('sorvete', 'Sorvete', 'sorveteira, gelato, sobremesa gelada', IconIceCream2),
  ] },
  { label: 'Calor e cocÃ§Ã£o', icons: [
    i('calor', 'Calor', 'fogo, chama, fogÃ£o, queima, calor', IconFlame),
    i('forno', 'Forno', 'forno, micro-ondas, aquecimento', IconMicrowave),
    i('fogao', 'FogÃ£o', 'cooktop, fogÃ£o industrial, fogÃ£o', IconCooker),
    i('grelha', 'Grelha', 'chapa, churrasqueira, grill, grelha', IconGrill),
    i('cozinha', 'Cozinha', 'utensÃ­lios, talheres, cozinha', IconToolsKitchen2),
    i('chef', 'Chef', 'cozinha, cocÃ§Ã£o, chef, gastronomia', IconChefHat),
  ] },
  { label: 'ElÃ©trica e energia', icons: [
    i('energia', 'Energia', 'elÃ©trica, raio, tensÃ£o, energia', IconBolt),
    i('tomada', 'Tomada', 'plugue, ponto elÃ©trico, tomada', IconPlug),
    i('conexao', 'ConexÃ£o', 'ligado, alimentaÃ§Ã£o, conexÃ£o', IconPlugConnected),
    i('bateria', 'Bateria', 'nobreak, carga, bateria', IconBattery),
    i('painel', 'Painel', 'placa, comando, eletrÃ´nica, painel', IconCpu),
  ] },
  { label: 'Ãgua e hidrÃ¡ulica', icons: [
    i('agua', 'Ãgua', 'gota, torneira, abastecimento, Ã¡gua', IconDroplet),
    i('hidraulica', 'HidrÃ¡ulica', 'vazamento, encanamento, hidrÃ¡ulica', IconDroplets),
    i('tubulacao', 'TubulaÃ§Ã£o', 'cano, tubo, rede, tubulaÃ§Ã£o', IconPipeline),
    i('balde', 'Balde', 'ralo, esgoto, descarte, balde', IconBucket),
    i('reservatorio', 'ReservatÃ³rio', "caixa d'Ã¡gua, tanque, reservatÃ³rio", IconTank),
  ] },
  { label: 'ClimatizaÃ§Ã£o e ventilaÃ§Ã£o', icons: [
    i('ar-condicionado', 'Ar-condicionado', 'split, climatizaÃ§Ã£o, ar-condicionado', IconAirConditioning),
    i('ventilacao', 'VentilaÃ§Ã£o', 'vento, circulaÃ§Ã£o de ar, ventilaÃ§Ã£o', IconWind),
    i('ventilador', 'Ventilador', 'hÃ©lice, exaustor, coifa, ventilador', IconPropeller),
    i('termometro', 'TermÃ´metro', 'temperatura, mediÃ§Ã£o, termÃ´metro', IconThermometer),
    i('calor-ambiente', 'Calor ambiente', 'quente, aquecedor, calor ambiente', IconTemperatureSun),
  ] },
  { label: 'Ferramentas e manutenÃ§Ã£o', icons: [
    i('ferramentas', 'Ferramentas', 'manutenÃ§Ã£o, reparo, conserto, ferramentas', IconTools),
    i('chave', 'Chave', 'chave de boca, ajuste, chave', IconTool),
    i('martelo', 'Martelo', 'obra, reparo, martelo', IconHammer),
    i('engrenagem', 'Engrenagem', 'configuraÃ§Ã£o, mecÃ¢nica, engrenagem', IconSettings),
    i('motor', 'Motor', 'motor, compressor', IconEngine),
    i('furadeira', 'Furadeira', 'perfuraÃ§Ã£o, parafuso, furadeira', IconHammerDrill),
  ] },
  { label: 'Limpeza', icons: [
    i('limpeza', 'Limpeza', 'higienizaÃ§Ã£o, desinfecÃ§Ã£o, limpeza', IconSpray),
    i('lavagem', 'Lavagem', 'lava-louÃ§as, lavadora, lavagem', IconWashMachine),
    i('escova', 'Escova', 'escovar, limpar, escova', IconBrush),
    i('lixo', 'Lixo', 'descarte, resÃ­duos, lixo', IconTrash),
    i('reciclagem', 'Reciclagem', 'reaproveitamento, reciclagem', IconRecycle),
  ] },
  { label: 'SeguranÃ§a', icons: [
    i('seguranca', 'SeguranÃ§a', 'proteÃ§Ã£o, conformidade, seguranÃ§a', IconShieldCheck),
    i('extintor', 'Extintor', 'incÃªndio, combate a fogo, extintor', IconFireExtinguisher),
    i('hidrante', 'Hidrante', 'incÃªndio, mangueira, hidrante', IconFireHydrant),
    i('camera', 'CÃ¢mera', 'cftv, monitoramento, cÃ¢mera', IconDeviceCctv),
    i('alarme', 'Alarme', 'alerta, sirene, alarme', IconAlarm),
    i('trava', 'Trava', 'fechadura, acesso, trava', IconLock),
  ] },
  { label: 'Cozinha e alimentos', icons: [
    i('liquidificador', 'Liquidificador', 'batedeira, processador, liquidificador', IconBlender),
    i('cafe', 'CafÃ©', 'cafeteira, mÃ¡quina de cafÃ©, cafÃ©', IconCoffee),
    i('bebidas', 'Bebidas', 'chopeira, bar, cervejeira, bebidas', IconBeer),
    i('garrafa', 'Garrafa', 'bebida, dispenser, garrafa', IconBottle),
    i('carnes', 'Carnes', 'aÃ§ougue, defumador, carnes', IconMeat),
    i('peixes', 'Peixes', 'pescados, sushi, peixes', IconFish),
    i('paes', 'PÃ£es', 'padaria, forno de pÃ£o, panificaÃ§Ã£o, pÃ£es', IconBread),
    i('pizza', 'Pizza', 'forno de pizza, pizzaria, pizza', IconPizza),
  ] },
  { label: 'IluminaÃ§Ã£o', icons: [
    i('lampada', 'LÃ¢mpada', 'luz, iluminaÃ§Ã£o, lÃ¢mpada', IconBulb),
    i('luminaria', 'LuminÃ¡ria', 'refletor, luminÃ¡ria', IconLamp),
  ] },
  { label: 'GÃ¡s', icons: [
    i('gas', 'GÃ¡s', 'glp, botijÃ£o, abastecimento, gÃ¡s', IconGasStation),
    i('medidor', 'Medidor', 'manÃ´metro, pressÃ£o, regulador, medidor', IconGauge),
  ] },
  { label: 'Estrutura e instalaÃ§Ãµes', icons: [
    i('predio', 'PrÃ©dio', 'instalaÃ§Ã£o, estrutura, prÃ©dio', IconBuilding),
    i('porta', 'Porta', 'portÃ£o, entrada, porta', IconDoor),
    i('janela', 'Janela', 'vidro, esquadria, janela', IconWindow),
    i('parede', 'Parede', 'alvenaria, revestimento, parede', IconWall),
    i('escada', 'Escada', 'acesso, degrau, escada', IconStairs),
  ] },
  { label: 'Equipamentos e outros', icons: [
    i('equipamento', 'Equipamento', 'caixa, aparelho, equipamento', IconBox),
    i('balanca', 'BalanÃ§a', 'pesagem, peso, balanÃ§a', IconScale),
    i('entrega', 'Entrega', 'transporte, carrinho, entrega', IconTruck),
    i('categoria', 'Categoria', 'geral, outros, categoria', IconCategory),
    i('etiqueta', 'Etiqueta', 'identificaÃ§Ã£o, etiqueta', IconTag),
    i('destaque', 'Destaque', 'estrela, favorito, destaque', IconStar),
    i('outros', 'Outros', 'diversos, nÃ£o classificado, outros', IconDots),
  ] },
];

export const ICON_CATALOG: CatalogIcon[] = ICON_GROUPS.flatMap((g) => g.icons);
const BY_ID = new Map(ICON_CATALOG.map((c) => [c.id, c]));
export const iconById = (id?: string): CatalogIcon | undefined => (id ? BY_ID.get(id) : undefined);
