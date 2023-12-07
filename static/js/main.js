function sendData(lien, output, speed) {
    var value = document.getElementById('input').value;
    $.ajax({
        url: `${lien}`,
        type: 'POST',
        data: JSON.stringify({'data': value }),
        success: function (response) {
            setTimeout(function(){
                p.style.display = "inline-block";
                typeEffect(response.answer, output, speed);
              }, 1000);
        },
        error: function (error) {
            console.log(error);
        }
    });
}



function typewriter(response) {
    var aText = [response, ""];
    var iSpeed = 50; // time delay of print out
    var iIndex = 0; // start printing array at this posision
    var iArrLength = aText[0].length; // the length of the text array
    var iScrollAt = 20; // start scrolling up at this many lines

    var iTextPos = 0; // initialise text position
    var sContents = ''; // initialise contents variable
    var iRow; // initialise current row
    sContents = ' ';
    iRow = Math.max(0, iIndex - iScrollAt);
    var destination = document.getElementById("typedtext");

    while (iRow < iIndex) {
        sContents += aText[iRow++] + '<br />';
    }
    destination.innerHTML = sContents + aText[iIndex].substring(0, iTextPos) + "_";
    if (iTextPos++ == iArrLength) {
        iTextPos = 0;
        iIndex++;
        if (iIndex != aText.length) {
            iArrLength = aText[iIndex].length;
            setTimeout("typewriter()", 500);
        }
    } else {
        setTimeout("typewriter()", iSpeed);
    }
}

function typeEffect(element1, element2, speed) {
    var text = element1.textContent;
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

