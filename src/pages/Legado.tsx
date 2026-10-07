/* SPEC-164: em /legado quem desenha a tela é o app estático antigo
   (public/app/*.js, carregado pelo index.html só nessa rota). O React não
   renderiza nada aqui para não disputar a página com ele. */
export default function Legado() {
  return null
}
