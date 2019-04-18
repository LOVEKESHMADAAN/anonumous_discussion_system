var path=require('path');
var http=require('http');
var express=require('express');
var socketIO=require('socket.io');
var favicon = require('serve-favicon');


var {isRealString} = require('./utils/validation');
var {generateMessage,generateLocationMessage,generateTypingMessage,generateDrawingTypingMessage} = require('./utils/message');
var {Users} = require('./utils/users');
var publicpath=path.join(__dirname,'../public');
var port=process.env.PORT||3000;
var app=express();
var server=http.createServer(app);
var io=socketIO(server);
var hbs=require('hbs');
var users=new Users();
//test code
var roomset=new Set();

app.use(express.static(publicpath));
app.use(favicon(publicpath + '/assets/favicon.ico'));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '../public'));

app.get('/', (req,res) =>{
  var myArr = Array.from(roomset);
  res.render('index',{roomlist:myArr});
});

hbs.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

io.on('connection', (socket) => {
  console.log('New user connected');

  socket.on('join',(params,callback) => {
    if (!isRealString(params.name) || !isRealString(params.room))
    {
      return callback('Name and room name are required');
    }

    var userroomlist=users.getUserList(params.room);
    console.log(userroomlist,'user in that room');
    var filteredlist=userroomlist.filter((user) => user === params.name);
    console.log(filteredlist,'filtered users');

    if(filteredlist.length>0)
    {
      console.log('Username already exists');
      return callback('Same username already exists in room please try again !');
    }

    socket.join(params.room);
    users.removeUser(socket.id);
    users.addUser(socket.id, params.name, params.room);
    //test code
    roomset.add(params.room);
    console.log(roomset);

    io.to(params.room).emit('updateUserList',users.getUserList(params.room));

    socket.emit('newMessage', generateMessage('Admin', 'Welcome to the chat app'));
    socket.broadcast.to(params.room).emit('newMessage', generateMessage('Admin', `${params.name} has joined`));
    socket.broadcast.to(params.room).emit('NotifyMeMessage', generateMessage('Admin', `${params.name} has joined`));
    callback();
  });


  socket.on('NotificationMessage',(message)=>{
     var user=users.getUser(socket.id);

     if(user)
     {
      socket.broadcast.to(user.room).emit('NotifyMeMessage',generateMessage(user.name, message.text));
     }
  });


  socket.on('user image', function (msg) {
      var user=users.getUser(socket.id);
      //console.log(msg);
      if(user)
      {
        socket.broadcast.to(user.room).emit('user image', user.name , msg);
      }
      console.log("image sent");
    });

  socket.on('createMessage', (message,callback) => {
    var user=users.getUser(socket.id);

    if (user && isRealString(message.text)) {
      io.to(user.room).emit('newMessage', generateMessage(user.name, message.text));
    }
    callback();
  });

  socket.on('typing',()=>{

    var user=users.getUser(socket.id);

    if(user) {
      socket.broadcast.to(user.room).emit('newTypingMessage',generateTypingMessage(user.name));
    }

  });

  socket.on('mouse-up-event',()=>{

     var user=users.getUser(socket.id);

    if(user) {
      socket.broadcast.to(user.room).emit('hide-drawing-feedback');
    }
  });

  socket.on('createLocationMessage',(coords) => {
    var user=users.getUser(socket.id);
    if(user) {
      io.to(user.room).emit('newLocationMessage',generateLocationMessage(user.name,coords.latitude,coords.longitude));
    }

  });

  socket.on('drawing-typing',()=>{
    var user=users.getUser(socket.id);

    if(user) {
      socket.broadcast.to(user.room).emit('newDrawingMessage',generateDrawingTypingMessage(user.name));
    }
  });

  socket.on('drawing', (data) => {
    var user=users.getUser(socket.id);
    if(user) {
      io.to(user.room).emit('drawing', data);
    }
  });

  socket.on('disconnect', () => {
    var user = users.removeUser(socket.id);

    if(user) {
      //test code
      var roomlist=users.getUserList(user.room);
      console.log(roomlist);
      if(roomlist.length===0) {
        roomset.delete(user.room);
      }
      console.log(roomset);
      io.to(user.room).emit('updateUserList',users.getUserList(user.room));
      io.to(user.room).emit('newMessage',generateMessage('Admin',`${user.name} has left`));
      io.to(user.room).emit('NotifyMeMessage',generateMessage('Admin',`${user.name} has left`));
    }
    console.log('User was disconnected');
  });




});



server.listen(port,()=>{
  console.log('Server started successfully on Port '+port);
});
