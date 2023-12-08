// form : le formulaire
// loader : En attente du chargement
// lien : Le lien pour la requête
// output : la balise dans laquelle on affiche la réponse de GERTHE IA
// speed : la vitesse à laquelle doit affiche les mot à l'écran
function sendData(form, loader, lien, output, speed) {
    // on recupère la question de l'utilisateur
    var value = form.elements['question'].value;
    // on envoie la requête 
    fetch(lien, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({'question': value }),
    })
    .then(response => response.json())
    // on affiche la réponse de GERTHE IA
    .then(result => {
        loader.style.display = 'none';
        setTimeout(function(){
            output.style.display = "inline-block";
            // La fonction typeEffect permet d'afficher la réponse mot par mot ou lettre par lettre
            typeEffect(result.answer, output, speed);
          }, 1000);
    })
    .catch(erreur => console.log('Error : ', erreur));
}

// element1 : la réponse de GERTHE IA
// element2 : la balise dans laquelle on affiche la réponse de GERTHE IA
// speed : la vitesse à laquelle doit affiche les mot à l'écran
function typeEffect(element1, element2, speed) {
    var text = element1;
    element2.innerHTML = "";
    
    var i = 0;
    var timer = setInterval(function() {
      if (i < text.length) {
        element2.append(text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
  }

