(function () {

    Parse.$ = jQuery;

    Parse.initialize("tGOmSEGNuVWmlADWKBd7pcmmx4wx8wEHnCPl8gzx", "uIllWQ7PJ5RT7qSFjR01i9BrnQh6Kr95U09unqCu");
    window.App = {
        Models: {},
        Collections: {},
        Views: {},
        Routers: {}
    };

//расширим стандартный объект событий нашими собственными
    var vent = {};
    _.extend(vent, Backbone.Events);

//конструктор модели
    App.Models.Task = Parse.Object.extend('Task', {
        defaults: {
            shared: false,
            done: false
        },
        validate: function (attrs) {
            if (!($.trim(attrs.title))) {
                return 'задача не может быть пустой'
            }
        },
        initialize: function () {
            this.on('error', function (model, error) {
                alert(error);
            });
        },
        //меняем свойство модели done-на противоположенное в зависимости от значения чекбокса
        toggleDoneSet: function () {
            this.get('done') ? this.save('done', false) : this.save('done', true)
        }
    });

//конструктор въюхи для модели
    App.Views.TaskView = Parse.View.extend({
        tagName: 'li',
        template: _.template($('#task-template').html()), //шалблон для отрисовки экземпляра модели

        //вешаем на кнопки обработчики событий
        events: {
            'click .edit': 'editTask',
            'click .edit-cancel': 'editCancel',
            'click .edit-confirm': 'editConfirm',
            'click .share-task-btn': 'shareTask', //расшарить задачу по е-мейлу
            'click .done-toggle': 'toggleDone',
            'click .delete': 'delete',
            'swipeleft' : 'animate'               //свайп с помощью hammer + jquery
        },

        //вешаем слушателей на изменение и удаление модели
        initialize: function () {
           //this.$el.addSwipeEvents().bind('swipeleft', this.delete.bind(this)); //свайп с помощью jquery.doubletup

            this.$el.hammer();                 //свайп с помощью hammer + jquery

            this.model.on('change', this.render, this);
            this.model.on('destroy', this.remove, this);
            this.$el.on('transitionend', this.transType.bind(this));
            vent.on('filterDone', this.filterDone, this);     //события на фильтры, генерируются роутером
            vent.on('filterAll', this.filterAll, this);
            vent.on('filterActive', this.filterActive, this);

        },

        render: function () {
            this.$el.html(this.template(this.model.toJSON()));

            this.doneClassSet();    //перечеркиваем выполненные задания
            this.sharedClassSet();  // добывим иконку к шаренным
            return this
        },

        //расшарить задачу по е-мейлу
        shareTask: function () {
            var shareFor = prompt('Введине e-mail пользователя', '');
            if (shareFor === null) return;

            var relation = this.model.relation("sharedFor");
            var query = new Parse.Query(Parse.User);
            query.equalTo("email", shareFor);               //
            query.first().then(function (res) {
                if (!res) {
                    console.log('No such user or wrong email');
                    return Parse.Promise.error("There was an error.")
                }
                console.log('Task shared for: ' + res.get('username'));
                relation.add(res);
                this.model.set('shared', true);
                return this.model.save();
            }.bind(this));
        },

        // редактируем задачу с помощью смены шаблона
        editTask: function () {
            this.template = _.template($('#edit-task-template').html());
            this.$el.html(this.template(this.model.attributes));
            this.$el.find("input[type='text']").focus();
        },

        //отмена изменений
        editCancel: function () {
            this.template = _.template($('#task-template').html());
            this.$el.html(this.template(this.model.attributes));
        },

        //сохраним изменения
        editConfirm: function () {
            var changedTask = this.$el.find("input[type='text']").val();
            this.model.save('title', changedTask);
            this.editCancel();
        },

        //editTask: function(){                 //редактируем задачу с помощью prompt
        //    var task = prompt('Изменить задачу', this.model.get('title'));
        //    if (task === null) return;
        //    this.model.save('title', task, {validate:true})
        //},

        toggleDone: function () {
            this.model.toggleDoneSet();
            this.doneClassSet();
        },

        //перечеркиваем выполненные задания
        doneClassSet: function () {
            if (this.model.get('done')) {
                this.$el.addClass('target-done');
                this.$el.find("input[type='button']").attr({disabled: "disabled"});
            }
            else this.$el.removeClass('target-done')
        },

        // добывим иконку к шаренным
        sharedClassSet: function () {
            if (this.model.get('shared')) {
                this.$el.addClass('sharedFor');
            }
            else this.$el.removeClass('sharedFor')
        },

        filterDone: function () {
            this.filterAll();
            if (!this.model.get('done'))
                this.$el.hide();
        },

        filterAll: function () {
            this.$el.show();
        },

        filterActive: function () {
            this.filterAll();
            if (this.model.get('done'))
                this.$el.hide();
        },

        transType: function(e){
            console.log(e.originalEvent.propertyName );
            if (e.originalEvent.propertyName == 'right') {       //удаляем элемент если событие cмена позиции в право
                this.delete();
            }
        },

        animate: function(){
            this.$el.css({'right':'1000px', 'height':'0'});
        },

        //удаляем модель
        delete: function () {
            this.model.destroy();
            console.log('модель удалена');
           // console.log(this.model)
        },

        //удаляем элемент модели из DOM
        remove: function () {
            this.$el.remove()
        }
    });

//конструктор для коллекции задач
    App.Collections.TasksCollection = Parse.Collection.extend({
        model: App.Models.Task,

        initialize: function () {
            vent.on('login', this.getElements, this);         //при успешном логине выполняем запрос заданий с сервера
           // this.getElements();
        },

        getDoneArr: function () {
            return this.filter(function (tasks) {
                return tasks.get('done');
            });
        },

        //запрос  списка заданий с сервера для текущего юзера
        getElements: function () {
            var user = Parse.User.current();
            var query1 = new Parse.Query(this.model);                     //запрос списка задач текущего пользователя
            var query2 = new Parse.Query(this.model);                    //запрос для шаринга
            query1.equalTo("user", user);
            query2.equalTo("sharedFor", user);                           //запрос для шаринга
            var mainQuery = Parse.Query.or(query1, query2);              //объединим два запроса
            mainQuery.find({
                success: function (res) {
                    targetsCollection.reset();
                    console.log(res);
                    for (var i in res) {
                        targetsCollection.add(res[i]);        //заполним колекцию списком с сервера, для каждого элемента
                    }                                         // сработает событие add, которое отработает вьюха
                },                                            //(в аргумент передана модель)
                error: function (er) {
                    console.log('Query error ' + er.massage)
                }
            });
        }
    });

//конструктор вьюхи для коллекции задач
    App.Views.TasksCollectionView = Parse.View.extend({
        tagName: 'ul',

        initialize: function () {
            this.collection.on('add', this.addOne, this);   //при добавлении элемента в коллекцию выполним addOne
            vent.on('deleteDone', this.deleteDone, this);
            vent.on('deleteAll', this.deleteAll, this);
           // vent.on('doneAll', this.doneAll, this);
          //  vent.on('login logout', this.toggle, this);
            vent.on('logout', this.erase, this);
          //  $('#main').html(this.render().el);
          //  this.$el.hide();
            this.render();
        },

        toggle: function () {
       //     this.$el.toggle();
        },

        erase: function () {
            this.collection.reset();
            this.$el.html('');
        },

        render: function () {
            this.collection.each(this.addOne, this);
            return this
        },

        //добавляем новый элемент в коллекцию (в аргумент передана модель)
        addOne: function (task) {
            var targetView = new App.Views.TaskView({model: task});
            this.$el.append(targetView.render().el)
        },



        deleteDone: function () {                                   // удаляем выполненные задачи
            _.each(this.collection.getDoneArr(), function (model) {
                model.destroy();
            });
            return false;
        },

        deleteAll: function () {                                 // удаляем все задачи
            for (var i = 0; i < this.collection.length; i++) {
                this.collection.models[i].destroy();
                i--;
            }
            console.log(this.collection)
        }
    });

// вьюха добавления задач в список
    App.Views.AddNewTaskView = Parse.View.extend({
        el: '#add-new-task',
        template: $('#add-task').html(),

        events: {
            'click .add-submit': 'submit',
            'click #done-all': 'doneAll'
        },

        //отмечаем весь список задач как выполненный (либо наоборот)
        doneAll: function () {
            this.collection.each(function (model) {
                model.save({done: $('#done-all').prop('checked') ? true : false})
            })
        },

        initialize: function () {
            this.render();
         //   this.$el.hide();
           // vent.on('login logout', this.toggle, this);
        },

        render: function () {
            this.$el.html(this.template);
            return this;
        },

        toggle: function () {
         //   this.$el.toggle();
        },

        submit: function (e) {
            e.preventDefault();
            var target = new App.Models.Task();
            target.save({
                title: this.$el.find('.new-task').val(),
                user: Parse.User.current()
            }, {
                success: function (model) {
                    this.collection.add(model);                //???????????????? так можно?
                }.bind(this),
                error: function (error) {
                    console.log(error.message)
                }
            });
            this.$el.find('.new-task').val('');
        }
    });

//вьюха удаления выполненых задач и очистка списка
    App.Views.ManageTaskView = Parse.View.extend({
        el: '#manage-task',

        template: $('#manage-task-template').html(),

        events: {
            'click .delete-done': 'deleteDone',
            'click .delete-all': 'deleteAll',
            'click .change-pic-btn': 'changePicture'
        },

        initialize: function () {
          //  this.$el.hide();
           // vent.on('login logout', this.toggle, this);
            this.render();
        },

        render: function () {
            this.$el.html(this.template);
            return this;
        },

        toggle: function () {
        //    this.$el.toggle();
        },

        deleteDone: function () {
            vent.trigger('deleteDone')
        },

        deleteAll: function () {
            vent.trigger('deleteAll')
        },

changePicture : function(event) {
    event.preventDefault();
    if (!navigator.camera) {
        alert("Camera API not supported", "Error");
        return;
    }
    var options =   {
        quality: 50,
        destinationType: Camera.DestinationType.DATA_URL,
        sourceType: 1,      // 0:Photo Library, 1=Camera, 2=Saved Album
        encodingType: 0     // 0=JPG 1=PNG
    };

    navigator.camera.getPicture(
        function(imgData) {
            $('#myImage').attr('src', "data:image/jpeg;base64,"+imgData);
            $('#myImage').css({'display':'block',
                                'height':'100px'});
        },
        function() {
            alert('Error taking picture', 'Error');
        },
        options);

    return false;
}
    });

    App.Views.LogOutView = Parse.View.extend({
        el: '#logout',

        template: $('#logout-template').html(),

        events: {
            'click .logout-btn': 'logout'
        },

        render: function () {
            this.$el.html(this.template);
            return this;
        },

        initialize: function(){
            // this.checkLogIn();                       //выводим имя текущего пользователя
            this.render()
        },

        logout: function () {
            Parse.User.logOut();
           // vent.trigger('logout');           //генерим событие логаут
            //this.checkLogIn();
            console.log('Выход успешен');
            //  this.clearError();
        },

        //выводим имя текущего пользователя
        checkLogIn: function () {
            var currentUser = Parse.User.current();
            if (currentUser) {
                console.log('Current user :' + currentUser.get('username'));
                $('.current-user').html('User: ' + currentUser.get('username'));
            }
            else {
                $('.current-user').html('');
                console.log('no current user');
            }
        }
    });



//вьюха логина и регистраци
    App.Views.LogInView = Parse.View.extend({
        el: '.reg-forms',

        template: $('#login-template').html(),

        events: {
            'click #signup-submit': 'signup',
            'click #login-submit': 'login',
            //'click .logout-btn': 'logout',
            'click #signup-back': 'signupRegToggle',
            'click #showreg': 'signupRegToggle'
        },

        render: function () {
            this.$el.html(this.template);
            return this;
        },

        initialize: function () {
            this.render();
            $('.registration').hide();
           // vent.on('login logout', this.loginLogoutToggle, this);
          //  this.checkCurrentUser();                //проверка активного пльзователя если есть генерим событие логин
           // this.checkLogIn();                       //выводим имя текущего пользователя
        },

        signupRegToggle: function () {
            this.clearError();
            $('.registration, .autorization').toggle();
        },

        loginLogoutToggle: function () {
         //   $('#login, #logout').toggle();
        },

        //logout: function () {
        //    Parse.User.logOut();
        //    vent.trigger('logout');           //генерим событие логаут
        //   // this.checkLogIn();
        //    console.log('Выход успешен');
        //  //  this.clearError();
        //},

        signup: function () {
            this.clearError();
            var name = $('#login-name').val();
            var pass = $('#login-password').val();
            var email = $('#signup-email').val();

            var user = new Parse.User();
            user.set('username', name);
            user.set('password', pass);
            user.set('email', email);
            user.signUp(null, {
                success: function (user) {
                    console.log('new user created');

                    alert('Пользователь зарегистрирован!');
                    this.signupRegToggle();
                    location.hash = 'todomain';
                    //vent.trigger('login');
                    //this.checkLogIn();
                }.bind(this),
                error: function (user, error) {
                    this.showError(error.message);
                }.bind(this)
            });
        },

        showError: function (err) {
            this.$el.append('<div class="error-msg">' + err + '</div>')
        },

        clearError: function () {
            var error = $('.error-msg');
            if (error) error.remove()
        },

        login: function (e) {
            e.preventDefault();
            this.clearError();
            var name = $('#login-name').val();
            var pass = $('#login-password').val();

            Parse.User.logIn(name, pass, {
                success: function (user) {
                    //vent.trigger('login');
                    location.hash = 'todomain';
                    console.log('Успешный вход');
                 //   this.checkLogIn();
                }.bind(this),
                error: function (user, error) {
                    this.showError(error.message);
                }.bind(this)
            });
        }

        ////выводим имя текущего пользователя
        //checkLogIn: function () {
        //    var currentUser = Parse.User.current();
        //    if (currentUser) {
        //        console.log('Current user :' + currentUser.get('username'));
        //        $('.current-user').html('User: ' + currentUser.get('username'));
        //    }
        //    else {
        //        $('.current-user').html('');
        //        console.log('no current user');
        //    }
        //},

        //checkCurrentUser: function () {
        //    if (Parse.User.current()) {
        //        vent.trigger('login');          //генерим событие логин
        //    }
        //}
    });


    //вьюха для управления отображением состояний (роутов)
    App.Views.ManageForRouteView = Parse.View.extend({

        el: ".wrapper",

        initialize: function(){
            this.loginView = new App.Views.LogInView;
            this.mainView = new App.Views.TasksCollectionView({collection: targetsCollection});
            this.logoutView = new App.Views.LogOutView;
            this.addNewTask = new App.Views.AddNewTaskView({collection: targetsCollection});
            this.manageTasks = new App.Views.ManageTaskView;
        },

        render: function(){

        },

        checkCurrentUser: function () {
            if (Parse.User.current()) {
                location.hash = 'todomain';          //генерим событие логин
            } else {
                location.hash = 'login';
            }
        },

        loginShow: function(){
           // this.$el.empty();
            this.mainView.$el.detach();
            this.logoutView.$el.detach();
            this.addNewTask.$el.detach();
            this.manageTasks.$el.detach();
            this.loginView.$el.appendTo(this.$el)
        },

        registerShow: function(){

        },

        todomainShow: function(){
            this.loginView.$el.detach();
            this.$el.find('H2').after(this.addNewTask.$el);
            this.$el.prepend(this.logoutView.$el);
            this.logoutView.checkLogIn();
            this.$el.append(this.manageTasks.$el);
            this.$el.find('#main').append(this.mainView.$el);



            //this.logoutView.$el.appendTo(this.$el);
            //console.log(this.logoutView.el);
            //console.log(this.el)
            vent.trigger('login');
            //this.$el.append(this.logView.render());
        }
    });

    App.Routers.Router = Backbone.Router.extend({
        routes: {
            ''         : 'index',
            'filter/:f': 'activateFilter',
            'login'    : 'login',
            'register' : 'register',
            'todomain' : 'todomain'
        },

        index: function () {
            manageForRouteView.checkCurrentUser();
        },

        login: function() {
            manageForRouteView.loginShow();
        },

        register: function() {
            manageForRouteView.registerShow();
        },

        todomain: function(){
            manageForRouteView.todomainShow()
        },

        activateFilter: function (f) {
            vent.trigger(f);
        }
    });

    var targetsCollection = new App.Collections.TasksCollection;
   // new App.Views.TasksCollectionView({collection: targetsCollection});
   // new App.Views.AddNewTaskView({collection: targetsCollection});
   // new App.Views.ManageTaskView;
    //new App.Views.LogInView;
    //new App.Views.LogOutView;
    var manageForRouteView = new App.Views.ManageForRouteView;
    new App.Routers.Router();
    Backbone.history.start();


})();