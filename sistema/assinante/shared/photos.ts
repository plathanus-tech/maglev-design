import forno2 from '../assets/forno2.webp';
import placa from '../assets/placa.webp';
import chapa from '../assets/chapa.jpg';
import images from '../assets/images.jpg';

/**
 * Fotos de demonstração: o cadastro guarda só o nome do arquivo; este mapa resolve o nome para a imagem (exemplos:
 * Forno combinado 01 e Chapa 01). Nome sem imagem conhecida continua aparecendo como arquivo sem miniatura.
 */
const DEMO_PHOTOS: Record<string, string> = { 'forno2.webp': forno2, 'placa.webp': placa, 'chapa.jpg': chapa, 'images.jpg': images };
export const photoSrc = (name?: string) => (name ? DEMO_PHOTOS[name] : undefined);
