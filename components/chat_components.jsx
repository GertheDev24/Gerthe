import { createRoot } from 'react-dom/client';

function ChatComponent() {
  return <>
   
 <div class="chatbot-ui">

  <div class="chatbot-header">Gerthe_IA</div>
  <div class="chatbot-section chatbot-input">
    <div class="chatbot-title">Input</div>
    
    <form method="post" autocomplete="off" id="form">
      <input type="text" name="question" id="question" placeholder="Posez-moi votre question ici " />
      <button type="submit">OK</button>
    </form>

  </div>

  <div class="chatbot-section chatbot-output">
    <div class="chatbot-title">Output</div>
    <p class="output-highlight" id="typedtext">
      {{ reponse }}
    </p>
  </div>
</div>
  
  </>;
}

const domNode = document.getElementById('gertheai');
const root = createRoot(domNode);
root.render(<ChatComponent />);