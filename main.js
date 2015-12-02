/**
 * Created by user on 17.11.15.
 */
//var Car = Parse.Object.extend('Car',{
//    model: 'Nissan',
//    color: 'gray'
//});
//
//var car1 = new Car();
//car1.set('year',2008);
//car1.set('power', 150);
//car1.save(null, {
//    success: function(car1) {
//            alert('Сохранен объект ' + car1.id);
//    },
//    error: function(car1, error) {
//         alert('Ошибка сохранения: ' + error.description);
//    }
//});

(function(){
    window.App = {
        Models: {},
        Collections: {},
        Views: {}
    };

    //расширим стандартный объект событий нашими собственными
        var vent = {};
        _.extend(vent, Backbone.Events);

    //конструктор модели
    App.Models.Task = Backbone.Model.extend({
        defaults:{
            done: false
        },
        validate: function(attrs){
            if (!($.trim(attrs.title))) {
                return 'задача не может быть пустой'
            }
        },
        initialize: function(){
            console.log('Создана новая задача');
            this.on('invalid', function(model, error){
                alert(error)
            });
        },
        //меняем свойство модели done-на противоположенное в зависимости от значения чекбокса
        toggleDoneSet: function(){
            this.get('done') ? this.set('done', false) : this.set('done', true)
        }
    });

    //конструктор въюхи для модели
    App.Views.TaskView = Backbone.View.extend({
        tagName: 'li',
        template: _.template($('#task-template').html()), //шалблон для отрисовки жэкземпляра модели

        //вешаем на кнопки обработчики событий
        events:{
            'click .edit': 'edit',
            'click .done-toggle': 'toggleDone',
            'click .delete': 'delete'
        },

        //вешаем слушателей на изменение и удаление модели
        initialize: function(){
            this.model.on('change', this.render, this);
            this.model.on('destroy', this.remove, this);
          //  this.model.on('remove', this.delete, this);

        },

        render: function(){
            this.$el.html(this.template(this.model.toJSON()));
            return this
        },

        edit: function(){
            var task = prompt('Изменить задачу', this.model.get('title'));
            if (task === null) return;
            this.model.set('title', task, {validate:true})
        },

        toggleDone: function(){
            this.model.toggleDoneSet();
            if (this.model.get('done')) {
                this.$el.addClass('target-done');
                this.$el.find('button').attr({disabled: "disabled"});
            }
            else this.$el.removeClass('target-done')
        },

        delete: function(){
            this.model.destroy();
            console.log('модель удалена')
        },

        remove: function(){
            this.$el.remove()
        }
    });

    App.Collections.TasksCollection = Backbone.Collection.extend({
        model: App.Models.Task,

        getDoneArr: function() {
            return this.filter(function(tasks){ return tasks.get('done'); });
        }
    });

    App.Views.TasksCollectionView = Backbone.View.extend({
        tagName: 'ol',

        initialize: function(){
            this.collection.on('add', this.addOne, this);
            vent.on('deleteDone', this.deleteDone, this);
            vent.on('deleteAll', this.deleteAll, this);
        },

        render: function(){
            this.collection.each(this.addOne, this);
            return this
        },

        addOne: function(task){
            var targetView = new App.Views.TaskView({model: task});
            this.$el.append(targetView.render().el)
        },

        deleteDone: function(){
            //for (var i=0; i<this.collection.length; i++) {
            //    var model = this.collection.models[i];
            //    if (model.get('done')) {
            //       // this.collection.remove(model)
            //        model.destroy();
            //        i--;
            //    }
            //}
            _.each(targetsCollection.getDoneArr(), function(model){ model.destroy(); });
            return false;
        },
        deleteAll: function(){
           // this.collection.reset();
            for (var i=0; i<this.collection.length; i++) {
                 this.collection.models[i].destroy();
                    i--;
            }
            console.log(this.collection)
        }
    });

    App.Views.AddNewTaskView = Backbone.View.extend({
        el: '#add-new-task',
        events: {
            'submit':'submit'
        },

        submit: function(e){
            e.preventDefault();
            var target = new App.Models.Task();
            var valid = target.set('title', this.$el.find('.new-task').val(), {validate: true});
            if (valid){
                targetsCollection.add(target);
            }
            this.$el.find('.new-task').val('');
        }
    });

    App.Views.DeleteTaskView = Backbone.View.extend({
        el: '#delete-task',
        events: {
            'click .delete-done': 'deleteDone',
            'click .delete-all' : 'deleteAll'
        },

        deleteDone: function(){
            vent.trigger('deleteDone')
        },

        deleteAll: function(){
            vent.trigger('deleteAll')

        }
    });

    var target = new App.Models.Task({title: 'Купить молоко'});
    var target1 = new App.Models.Task({title: 'Задача 1'});
   // var target = new App.Models.Task;
    var targetsCollection = new App.Collections.TasksCollection([
        {title: 'Купить хлеб'},
        {title: 'Позвонить сестре'},
        {title: 'Задача 2'},
        {title: 'Сходить в спортзал'},
        {title: 'Забрать дочку из школы'},
        {title: 'Задача 3'}
    ]);

    targetsCollection.add(target);
    targetsCollection.add(target1);

var targetCollectionView = new App.Views.TasksCollectionView({collection: targetsCollection});
var addNewTargetView = new App.Views.AddNewTaskView;
var deleteTargetView = new App.Views.DeleteTaskView;

$('#main').html(targetCollectionView.render().el);

})();