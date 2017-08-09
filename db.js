import Sequelize from 'sequelize';
import Faker from 'faker';
import _ from 'lodash';

const seriesInput = [
  { label: 'Email 1', daysToSend: 0,  sgTemplateID: 'db6d9991-5136-4fba-82ef-6c5e98649caf' }, 
  { label: 'Email 2', daysToSend: 1,  sgTemplateID: 'ef3d3c2c-f6f1-4057-8389-f82e071c7f5c' },
  { label: 'Email 3', daysToSend: 5,  sgTemplateID: '3fb326bd-ae78-40d0-9622-0fdf1cc0d235' }, 
  { label: 'Email 4', daysToSend: 15, sgTemplateID: 'bd9955e3-19eb-4bb0-a669-dc42a79cec6f' }, 
  { label: 'Email 5', daysToSend: 30, sgTemplateID: '3b9986aa-ee99-4f18-9693-d6ac29064f11' }    
];


const Conn = new Sequelize('email_series', 'devinchasanoff', 'password', {
  dialect: 'postgres',
  host: 'localhost'
});

const User = Conn.define('user', {
  email: { type: Sequelize.STRING, allowNull: false },
  firstName: { type: Sequelize.STRING },
  lastName: { type: Sequelize.STRING }
});

const EmailSeries = Conn.define('emailSeries', {
  label: { type: Sequelize.STRING, allowNull: false }
});

const SeriesStage = Conn.define('seriesStage', {
  label: { type: Sequelize.STRING, allowNull: false },
  daysToSend: { type: Sequelize.INTEGER, allowNull: false },
  sgTemplateID: { type: Sequelize.STRING, allowNull: false }
});

const UserSeries = Conn.define('userSeries', {
  stopEmails: { type: Sequelize.BOOLEAN, defaultValue: false, allowNull: false },
  startDate: { type: Sequelize.DATE, allowNull: false }
});

User.belongsToMany(EmailSeries, { through: UserSeries });
EmailSeries.belongsToMany(User, { through: UserSeries });

EmailSeries.hasMany(SeriesStage, { as: 'Stages' });
SeriesStage.belongsTo(EmailSeries);

exports.populate = () => {
  Conn.sync({ force: true }).then(() => {
    createUser(10, 0, [], users => {
      EmailSeries.create({ label: 'Welcome Series' }).then(series => {
        createUserSeries(users, series, 0, () => {
          createStages(5, series.id, 0, () => {
            console.log('Database successfully popualted');
            process.exit();
          });
        });
      }); 
    });
  });
}

function createUser(numUsers, i=0, userList=[], callback) {
  if (i == numUsers) { return callback(userList); }

  let email;

  if (i < numUsers / 2) {
    email = 'devchas@gmail.com';
  } else {
    email = 'devin.chasanoff@sendgrid.com';
  }

  User.create({
    email,
    firstName: Faker.name.firstName(),
    lastName: Faker.name.lastName()  
  }).then(user => {
    userList.push(user);
    i++;
    createUser(numUsers, i, userList, callback);
  });
}

function createUserSeries(users, series, i=0, callback) {
  if (i == users.length) { return callback(); }

  const daysIndex = i % seriesInput.length;
  const daysAgo = seriesInput[daysIndex].daysToSend;
  const startDate = new Date(new Date() - (daysAgo * 24 * 60 * 60 * 1000));

  users[i].addEmailSeries(series, { through: { startDate } }).then(() => {
    i++;
    createUserSeries(users, series, i, callback);
  });
}

function createStages(numStages, emailSeryId, i=0, callback) {
  if (i == numStages) { return callback(); }

  const seriesWithSeriesId = Object.assign({}, seriesInput[i], { emailSeryId });

  SeriesStage.create(seriesWithSeriesId).then(stage => {
    i++;  
    createStages(numStages, emailSeryId, i, callback);
  });
}

export default Conn;