import { Scene } from './types';

export const STORY: Scene[] = [
  {
    id: 'intro_1',
    background: 'forest',
    dialogues: [
      { character: 'Narrador', text: 'O silêncio da floresta é interrompido apenas pelo som distante de um riacho.' },
      { character: 'Narrador', text: 'Vaga-lumes dançam entre as árvores, iluminando o caminho com pulsações suaves de luz.' },
      { character: 'Elesis', text: 'Eu não deveria estar aqui a esta hora...' },
    ],
    choices: [
      { text: 'Continuar andando', nextSceneId: 'forest_walk' },
      { text: 'Parar e observar', nextSceneId: 'forest_observe', isImportant: true },
    ],
  },
  {
    id: 'forest_walk',
    background: 'forest',
    dialogues: [
      { character: 'Elesis', text: 'Preciso encontrar a saída antes que a névoa engula tudo.' },
      { character: 'Narrador', text: 'Você apressa o passo, mas as árvores parecem se fechar ao seu redor.' },
    ],
    nextSceneId: 'city_transition',
  },
  {
    id: 'forest_observe',
    background: 'forest',
    dialogues: [
      { character: 'Elesis', text: 'É lindo... de uma forma assustadora.' },
      { character: 'Narrador', text: 'O tempo parece parar enquanto você observa a dança das luzes.' },
      { character: '???', text: 'Você também consegue vê-los?' },
    ],
    nextSceneId: 'city_transition',
  },
  {
    id: 'city_transition',
    background: 'city',
    dialogues: [
      { character: 'Narrador', text: 'De repente, a floresta desaparece. O cheiro de terra úmida é substituído por ozônio e asfalto molhado.' },
      { character: 'Narrador', text: 'Luzes neon refletem nas poças de chuva de uma metrópole que nunca dorme.' },
      { character: 'Elesis', text: 'Onde... onde eu estou?' },
    ],
    choices: [
      { text: 'Explorar a rua principal', nextSceneId: 'city_explore' },
      { text: 'Procurar abrigo da chuva', nextSceneId: 'city_shelter' },
    ],
  },
  {
    id: 'city_explore',
    background: 'city',
    dialogues: [
      { character: 'Narrador', text: 'Você caminha sob os outdoors gigantes. A tecnologia aqui é avançada demais para o seu tempo.' },
      { character: 'Elesis', text: 'Isso parece um sonho... ou um pesadelo futurista.' },
    ],
    nextSceneId: 'room_end',
  },
  {
    id: 'city_shelter',
    background: 'city',
    dialogues: [
      { character: 'Narrador', text: 'Você se esconde sob o toldo de uma loja fechada. A chuva cai pesada, abafando os sons da cidade.' },
      { character: 'Elesis', text: 'Pelo menos aqui estou seca.' },
    ],
    nextSceneId: 'room_end',
  },
  {
    id: 'room_end',
    background: 'room',
    dialogues: [
      { character: 'Narrador', text: 'A luz muda novamente. O calor do pôr do sol entra pela janela de um quarto familiar.' },
      { character: 'Narrador', text: 'Poeira dança nos raios de sol. Tudo parece em paz.' },
      { character: 'Elesis', text: 'Foi tudo... apenas uma visão?' },
      { character: 'Narrador', text: 'Fim do Prólogo.' },
    ],
  },
];
