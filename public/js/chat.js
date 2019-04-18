var socket=io();

function scrollToBottom() {

  var messages = jQuery('#messages');
  var newMessage=messages.children('li:last-child');
  var clientHeight = messages.prop('clientHeight');
  var scrollTop = messages.prop('scrollTop');
  var scrollHeight = messages.prop('scrollHeight');
  var newMessageHeight=newMessage.innerHeight();
  var lastMessageHeight=newMessage.prev().innerHeight();

  if(clientHeight + scrollTop + newMessageHeight + lastMessageHeight >=scrollHeight){
    console.log(scroll);
    messages.scrollTop(scrollHeight);
  }
};

//draw-room start
(function() {
  var canvas = document.getElementsByClassName('whiteboard')[0];
  var colors = document.getElementsByClassName('color');
  var context = canvas.getContext('2d');

  var current = {
    color: 'black'
  };
  var drawing = false;

  canvas.addEventListener('mousedown', onMouseDown, false);
  canvas.addEventListener('mouseup', onMouseUp, false);
  canvas.addEventListener('mouseout', onMouseUp, false);
  canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

  for (var i = 0; i < colors.length; i++){
    colors[i].addEventListener('click', onColorUpdate, false);
  }

  socket.on('drawing', onDrawingEvent);

  window.addEventListener('resize', onResize, false);
  onResize();


  function drawLine(x0, y0, x1, y1, color, emit){
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
    context.closePath();

    if (!emit) { return; }
    var w = canvas.width;
    var h = canvas.height;

    socket.emit('drawing', {
      x0: x0 / w,
      y0: y0 / h,
      x1: x1 / w,
      y1: y1 / h,
      color: color
    });
  }

  function onMouseDown(e){
    drawing = true;
    current.x = e.clientX;
    current.y = e.clientY;
  }

  function onMouseUp(e){
    if (!drawing) { return; }
    drawing = false;
    drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
  }

  function onMouseMove(e){
    if (!drawing) { return; }
    drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
    current.x = e.clientX;
    current.y = e.clientY;
  }

  function onColorUpdate(e){
    current.color = e.target.className.split(' ')[1];
  }

  // limit the number of events per second
  function throttle(callback, delay) {
    var previousCall = new Date().getTime();
    return function() {
      var time = new Date().getTime();

      if ((time - previousCall) >= delay) {
        previousCall = time;
        callback.apply(null, arguments);
      }
    };
  }

  function onDrawingEvent(data){
    var w = canvas.width;
    var h = canvas.height;
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
  }

  // make the canvas fill its parent
  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

})();
//draw-room end

function notifyMe(time,from,message) {
  if (Notification.permission !== "granted")
    Notification.requestPermission();
  else {
    var notification = new Notification(from+' ('+time+')', {
      icon: 'http://www.myiconfinder.com/uploads/iconsets/256-256-dd9a48c8e1ff8027f8ce4c201769f5e7.png',
      body: message
    });
  }
}

socket.on('connect',function(){
  var params = jQuery.deparam(window.location.search);

  socket.emit('join', params , function(err){
    if (err) {
      alert(err);
      window.location.href = '/';
    }
    else {
      console.log('No error');
    }
  });
  jQuery('#welcome-msg').text('Welcome '+params.name+' !');
  var ul=jQuery('<ul></ul>');
  ul.append(jQuery('<li></li>').text(params.room));
  jQuery('#room-name').html(ul);
});

socket.on('disconnect',function(){
  console.log('Disconnected from server');

});

socket.on('updateUserList',function (users) {
  var ol=jQuery('<ol></ol>');
  users.forEach( function( user) {
    ol.append(jQuery('<li></li>').text(user));
  });
  jQuery('#users').html(ol);
});



socket.on('newMessage',function(message){
  jQuery('#feedback').html('');
  jQuery('#feedback').hide();
  var formattedTime=moment(message.createdAt).format('h:mm a');
  var template=jQuery('#message-template').html();
  var html=Mustache.render(template,{
    text:message.text,
    from:message.from,
    createdAt:formattedTime
  });
  jQuery('#messages').append(html);
  // if(jQuery('#mySidebar').is(':visible'))
  // {
  //   notifyMe(formattedTime,message.from,message.text);
  // }
  scrollToBottom();
});

socket.on('newLocationMessage',function(message){

  jQuery('#feedback').html('');
  jQuery('#feedback').hide();
  var formattedTime=moment(message.createdAt).format('h:mm a');
  var template=jQuery('#location-message-template').html();
  var html=Mustache.render(template,{
    from:message.from,
    url:message.url,
    createdAt:formattedTime
  });

  jQuery('#messages').append(html);
  scrollToBottom();
});

socket.on('newTypingMessage',function(message){
  jQuery('#feedback').show();
  var template=jQuery('#typing-message-template').html();
  var html=Mustache.render(template,{
    text:message.text
  });
  jQuery('#feedback').html(html);
  scrollToBottom();
});

socket.on('NotifyMeMessage',function(message){
  var formattedTime=moment(message.createdAt).format('h:mm a');
  notifyMe(formattedTime,message.from,message.text);
});


socket.on('newDrawingMessage',function(message){
  jQuery('#drawing-feedback').show();
  var template=jQuery('#drawing-message-template').html();
  var html=Mustache.render(template,{
    text:message.text
  });
  jQuery('#drawing-feedback').html(html);
  
});

socket.on('hide-drawing-feedback',function(){
  jQuery('#drawing-feedback').hide();
});

jQuery('#message-form').on('submit',function(e){
  e.preventDefault();

  var messageTextbox=jQuery('[name=message]');
  socket.emit('createMessage',{
    //from:'User',
    text:messageTextbox.val()
  },function(){
    messageTextbox.val('');
  });

  socket.emit('NotificationMessage',{
    text:messageTextbox.val()
  });

});

jQuery('[name=message]').on('keydown',function(){
  socket.emit('typing');
});

jQuery('[name=board]').on('mousedown',function(){
  console.log('mouse moved down');
  socket.emit('drawing-typing');
});

jQuery('[name=board]').on('mouseup',function(){
  console.log('mouse moved up');
  socket.emit('mouse-up-event');
});

var locationButton = jQuery('#send-location');

function image (from, base64Image) {
  // var d = new Date();
  // //output.innerHTML+='<p><strong>'+username.value+' <font color=green>'+d.getHours()+':'+d.getMinutes()+'</font>'+':</strong>'+'</p>'+'</br>'+'<img src="' + base64Image + '"/>';
  //   $('#messages').append($('<p>').append($('<strong>').text(from), '<strong>' +' <font color=green>'+d.getHours()+':'+d.getMinutes()+'</font>'+'</strong>'+'</br>', '<img src="' + base64Image + '"/>'));
  jQuery('#feedback').html('');
  jQuery('#feedback').hide();
  var formattedTime=moment(moment().valueOf()).format('h:mm a');
  var template=jQuery('#image-message-template').html();
  var html=Mustache.render(template,{
    from:from,
    url:base64Image,
    createdAt:formattedTime
  });

  jQuery('#messages').append(html);
  scrollToBottom();
  socket.emit('NotificationMessage',{
    text:'Sent An Image'
  });

 }


socket.on('user image', image);


$('#imagefile').bind('change', function(e){
      var data = e.originalEvent.target.files[0];
      var reader = new FileReader();
      reader.onload = function(evt){
        image('Me', evt.target.result);
        socket.emit('user image', evt.target.result);
      };
      reader.readAsDataURL(data);
});

locationButton.on('click',function(){
  if(!navigator.geolocation) {
    return alert('Geolocation not supported By Browser');
  }
  else {
    locationButton.attr('disabled','disabled').text('Sending location...');
    navigator.geolocation.getCurrentPosition(function (position) {
      locationButton.removeAttr('disabled').text('Send Location');
      socket.emit('createLocationMessage',{
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      socket.emit('NotificationMessage',{
          text:'Sent Location'
      });
    } ,function(){
      locationButton.removeAttr('disabled').text('Send Location');
      alert('Unable to fetch Location');
    });
  }
});
