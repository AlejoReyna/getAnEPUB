export const messages=[
'Preparando las hojas…',
'Convenciendo al PDF de mudarse…',
'Quitando las migas de entre las páginas…',
'Enseñándole al libro a viajar ligero…',
'Desdoblando los párrafos…',
'Contando páginas, no ovejas…',
'Poniendo cada letra en su lugar…',
'Negociando con los saltos de página…',
'Revisando que no se escape ninguna tilde…',
'Acomodando los dibujos en su asiento…',
'Haciendo espacio en tu biblioteca…',
'Dándole vacaciones al zoom…',
'Planchando las esquinas digitales…',
'Recordándole al índice dónde vive cada capítulo…',
'Guardando el drama para el último capítulo…',
'Poniendo a las comas en fila…',
'Despidiéndonos del pellizcar para ampliar…',
'Preparando la portada para su gran entrada…',
'Empacando páginas, sin doblar las puntas…',
'Tu EPUB ya se está poniendo guapo…'
];

export const englishMessages=[
'Getting the pages ready…',
'Convincing your PDF to move out…',
'Brushing the crumbs out of the pages…',
'Teaching your book to travel light…',
'Unfolding the paragraphs…',
'Counting pages, not sheep…',
'Putting every letter in its place…',
'Negotiating with the page breaks…',
'Making sure no accents get left behind…',
'Finding a seat for every illustration…',
'Making room on your bookshelf…',
'Giving pinch-to-zoom a day off…',
'Ironing out the digital corners…',
'Reminding the table of contents where each chapter lives…',
'Saving the drama for the final chapter…',
'Getting the commas in line…',
'Waving goodbye to endless zooming…',
'Getting the cover ready for its big entrance…',
'Packing the pages. No dog-ears allowed…',
'Your EPUB is looking sharp…'
];
export function shuffledIndices(random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32){const list=messages.map((_,i)=>i);for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
export function shuffledMessages(random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32){return shuffledIndices(random).map(i=>messages[i]);}
