import Sequelize from 'sequelize';
import Faker from 'faker';
import _ from 'lodash';
import { series } from './index';

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
  seriesName: { type: Sequelize.STRING, required: true },
  stopEmails: { type: Sequelize.BOOLEAN, defaultValue: false, required: true },
  templateVersion: { type: Sequelize.INTEGER, defaultValue: 0, required: true }
});

EmailSeries.belongsTo(User);
User.hasMany(EmailSeries, { as: 'userEmailSeries' });

exports.populate = () => {
  if (process.env.NODE_ENV !== 'test') {
    Conn.sync({ force: true }).then(() => {
      _.times(series[0].seriesData.length, i => {
        User.create({ 
          email: 'devchas@gmail.com',
          firstName: Faker.name.firstName(),
          lastName: Faker.name.lastName()
        }).then(user => {
          EmailSeries.create({ 
            userId: user.id,
            seriesName: 'welcome',
            createdAt: new Date(new Date() - (series[0].seriesData[i].days * 24 * 60 * 60 * 1000))
          }).then(() => {
            if (i == 0) {
              User.create({
                email: 'devchas@gmail.com',
                firstName: Faker.name.firstName(),
                lastName: Faker.name.lastName()              
              }).then(user => {
                EmailSeries.create({
                  userId: user.id,
                  seriesName: 'firstPurchase',
                  templateVersion: 1,
                  createdAt: new Date(new Date() - (series[0].seriesData[1].days * 24 * 60 * 60 * 1000))
                });
              });
            }
          });
        });
      });
    });
  }
}

function randomInt(min, max) {
  return Math.round((Math.random() * (max - min) + min));
}

export default Conn;